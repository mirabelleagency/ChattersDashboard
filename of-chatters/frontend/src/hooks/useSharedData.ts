import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export interface ChatterPerformance {
  chatter: string
  sales: number
  worked_hrs: number
  start_date?: string
  end_date?: string
  sph: number
  art: string
  gr: number
  ur: number
  ranking: number
  shift: string
}

export interface Chatter {
  id: number
  external_id?: string
  name: string
  handle?: string
  email?: string
  phone?: string
  team_name?: string
  is_active: boolean
}

// Sample data for performance metrics
const INITIAL_PERFORMANCE_DATA: ChatterPerformance[] = [
  { chatter: 'Lowie', sales: 14157.67, worked_hrs: 96, start_date: '2023-10-01', end_date: '2023-10-15', sph: 147.48, art: '51s', gr: 3.65, ur: 68.71, ranking: 1, shift: 'Shift A' },
  { chatter: 'Jerald', sales: 7388.00, worked_hrs: 75, start_date: '2023-10-01', end_date: '2023-10-15', sph: 98.51, art: '2m 5s', gr: 8.34, ur: 58.70, ranking: 2, shift: 'Shift C' },
  { chatter: 'RM', sales: 5760.00, worked_hrs: 72, start_date: '2023-10-01', end_date: '2023-10-15', sph: 80.00, art: '2m 8s', gr: 5.19, ur: 70.59, ranking: 3, shift: 'Shift B' },
  { chatter: 'Laurence', sales: 9258.39, worked_hrs: 120.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 76.83, art: '1m 59s', gr: 7.55, ur: 50.22, ranking: 4, shift: 'Shift C' },
  { chatter: 'Emman', sales: 4992.00, worked_hrs: 66, start_date: '2023-10-01', end_date: '2023-10-15', sph: 75.64, art: '1m 54s', gr: 5.96, ur: 59.29, ranking: 5, shift: 'Shift C' },
  { chatter: 'JC', sales: 7248.00, worked_hrs: 97.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 74.34, art: '2m 7s', gr: 5.02, ur: 41.67, ranking: 6, shift: 'Shift C' },
  { chatter: 'Marlon', sales: 4627.95, worked_hrs: 70, start_date: '2023-10-01', end_date: '2023-10-15', sph: 66.11, art: '1m 57s', gr: 2.22, ur: 56.25, ranking: 8, shift: 'Shift B' },
  { chatter: 'Jerome', sales: 3644.00, worked_hrs: 55.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 65.66, art: '1m 32s', gr: 3.24, ur: 65.38, ranking: 7, shift: 'Shift C' },
  { chatter: 'Jepp', sales: 6011.23, worked_hrs: 97, start_date: '2023-10-01', end_date: '2023-10-15', sph: 61.97, art: '1m 19s', gr: 4.24, ur: 53.45, ranking: 9, shift: 'Shift C' },
  { chatter: 'Baste', sales: 6492.00, worked_hrs: 112, start_date: '2023-10-01', end_date: '2023-10-15', sph: 57.96, art: '1m 38s', gr: 2.58, ur: 54.46, ranking: 10, shift: 'Shift B' },
  { chatter: 'Salman', sales: 4355.49, worked_hrs: 77, start_date: '2023-10-01', end_date: '2023-10-15', sph: 56.56, art: '1m 11s', gr: 2.23, ur: 60.00, ranking: 11, shift: 'Shift A' },
  { chatter: 'Tomm', sales: 2540.00, worked_hrs: 65, start_date: '2023-10-01', end_date: '2023-10-15', sph: 39.08, art: '1m 21s', gr: 2.95, ur: 49.12, ranking: 12, shift: 'Shift B' },
  { chatter: 'Rowie', sales: 2425.60, worked_hrs: 64, start_date: '2023-10-01', end_date: '2023-10-15', sph: 37.90, art: '1m 58s', gr: 4.96, ur: 61.11, ranking: 13, shift: 'Shift B' },
  { chatter: 'Bols', sales: 2608.00, worked_hrs: 74, start_date: '2023-10-01', end_date: '2023-10-15', sph: 35.24, art: '2m 2s', gr: 3.41, ur: 56.76, ranking: 14, shift: 'Shift A' },
  { chatter: 'Miko', sales: 2468.80, worked_hrs: 75.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 32.70, art: '2m 49s', gr: 4.85, ur: 55.56, ranking: 15, shift: 'Shift A' },
  { chatter: 'Rommel', sales: 2282.40, worked_hrs: 81, start_date: '2023-10-01', end_date: '2023-10-15', sph: 28.18, art: '1m 46s', gr: 4.00, ur: 63.33, ranking: 16, shift: 'Shift A' },
];

export function useSharedData() {
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [performanceData, setPerformanceData] = useState<ChatterPerformance[]>(INITIAL_PERFORMANCE_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadChatters = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await api<Chatter[]>('/admin/chatters')
      setChatters(rows)

      // Keep dashboard data in sync with chatters list:
      // - Preserve any existing metrics for names we already have
      // - Create placeholder metrics for any newly found chatters
      setPerformanceData(prev => {
        const byName = new Map(prev.map(p => [p.chatter, p]))
        const merged: ChatterPerformance[] = rows.map(c => {
          const existing = byName.get(c.name)
          if (existing) return existing
          // Default placeholder metrics for new chatters
          return {
            chatter: c.name,
            sales: 0,
            worked_hrs: 0,
            sph: 0,
            art: '0s',
            gr: 0,
            ur: 0,
            ranking: 999,
            shift: 'Shift A',
          }
        })
        return merged
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load chatters')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChatters()
  }, [loadChatters])

  const updatePerformance = useCallback((chatter: string, updates: Partial<ChatterPerformance>) => {
    setPerformanceData(prev => 
      prev.map(p => p.chatter === chatter ? { ...p, ...updates } : p)
    )
  }, [])

  const updateChatter = useCallback(async (chatterId: number, payload: any) => {
    const res = await api<Chatter>(`/admin/chatters/${chatterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    setChatters(prev => prev.map(c => c.id === chatterId ? res : c))
    return res
  }, [])

  const deleteChatter = useCallback(async (chatterId: number, { soft = true }: { soft?: boolean } = {}) => {
    await api(`/admin/chatters/${chatterId}?soft=${soft ? 'true' : 'false'}`, {
      method: 'DELETE',
    })
    // Use the same snapshot to determine removed name and update both states consistently
    setChatters(prev => {
      const removed = prev.find(c => c.id === chatterId)
      if (removed) {
        setPerformanceData(prevPerf => prevPerf.filter(p => p.chatter !== removed.name))
      }
      return prev.filter(c => c.id !== chatterId)
    })
  }, [])

  return {
    chatters,
    performanceData,
    loading,
    error,
    loadChatters,
    updatePerformance,
    updateChatter,
    deleteChatter,
    setPerformanceData,
  }
}
