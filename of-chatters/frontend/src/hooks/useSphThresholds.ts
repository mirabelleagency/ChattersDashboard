import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

export type SphThresholds = {
	excellentMin: number // SPH >= excellentMin -> Excellent
	reviewMax: number    // SPH < reviewMax -> Needs Review
}

const STORAGE_KEY = 'sphThresholds.v1'
const DEFAULTS: SphThresholds = { excellentMin: 100, reviewMax: 40 }

function readFromStorage(): SphThresholds {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return DEFAULTS
		const parsed = JSON.parse(raw)
		// Validate shape and coerce to numbers
		const excellentMin = Number(parsed.excellentMin)
		const reviewMax = Number(parsed.reviewMax)
		if (!Number.isFinite(excellentMin) || !Number.isFinite(reviewMax)) return DEFAULTS
		return { excellentMin, reviewMax }
	} catch {
		return DEFAULTS
	}
}

export function useSphThresholds() {
	const [thresholds, setThresholds] = useState<SphThresholds>(DEFAULTS)
	const [loaded, setLoaded] = useState(false)
	const savingRef = useRef(false)

	useEffect(() => {
		// Try server first; fallback to local storage
		let cancelled = false
		;(async () => {
			try {
				const res = await api<{ excellent_min: number; review_max: number }>(
					'/admin/dashboard-thresholds'
				)
				if (!cancelled) {
					const next: SphThresholds = {
						excellentMin: Number(res.excellent_min) || DEFAULTS.excellentMin,
						reviewMax: Number(res.review_max) || DEFAULTS.reviewMax,
					}
					setThresholds(next)
					try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
				}
			} catch {
				if (!cancelled) setThresholds(readFromStorage())
			} finally {
				if (!cancelled) setLoaded(true)
			}
		})()
		return () => { cancelled = true }
	}, [])

	const updateThresholds = useCallback((next: Partial<SphThresholds>) => {
		setThresholds(prev => {
			const merged: SphThresholds = {
				excellentMin: Number(next.excellentMin ?? prev.excellentMin) || DEFAULTS.excellentMin,
				reviewMax: Number(next.reviewMax ?? prev.reviewMax) || DEFAULTS.reviewMax,
			}
			try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
			// Fire-and-forget persist to server; ignore while initial load isn't done
			if (loaded && !savingRef.current) {
				savingRef.current = true
				;(async () => {
					try {
						await api('/admin/dashboard-thresholds', {
							method: 'PUT',
							body: JSON.stringify({
								excellent_min: merged.excellentMin,
								review_max: merged.reviewMax,
							}),
						})
					} catch (e) {
						// no-op; keep local state; optionally surface toast elsewhere
						console.error('Failed to save thresholds', e)
					} finally {
						savingRef.current = false
					}
				})()
			}
			return merged
		})
	}, [loaded])

	const resetThresholds = useCallback(() => {
		try { localStorage.removeItem(STORAGE_KEY) } catch {}
		setThresholds(DEFAULTS)
	}, [])

	return { thresholds, setThresholds: updateThresholds, resetThresholds, defaults: DEFAULTS }
}

