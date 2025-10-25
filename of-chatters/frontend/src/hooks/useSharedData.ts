import { useState, useEffect, useCallback, useMemo } from 'react'
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

interface DashboardMetricApi {
  chatter_name: string
  total_sales: number | null
  worked_hours: number | null
  start_date: string | null
  end_date: string | null
  sph: number | null
  art: string | null
  gr: number | null
  ur: number | null
  ranking: number | null
  shift: string | null
}

function toChatterPerformance(metric: DashboardMetricApi): ChatterPerformance {
  return {
    chatter: metric.chatter_name,
    sales: metric.total_sales ?? 0,
    worked_hrs: metric.worked_hours ?? 0,
    start_date: metric.start_date ?? undefined,
    end_date: metric.end_date ?? undefined,
    sph: metric.sph ?? 0,
    art: metric.art || '0s',
    gr: metric.gr ?? 0,
    ur: metric.ur ?? 0,
    ranking: metric.ranking ?? Number.MAX_SAFE_INTEGER,
    shift: metric.shift || '—',
  }
}

export function useSharedData() {
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [metrics, setMetrics] = useState<DashboardMetricApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchChatters = useCallback(async () => {
    const rows = await api<Chatter[]>('/admin/chatters')
    setChatters(rows)
    return rows
  }, [])

  const fetchMetrics = useCallback(async () => {
    const rows = await api<DashboardMetricApi[]>('/admin/dashboard-metrics/summary')
    setMetrics(rows)
    return rows
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      await Promise.all([fetchChatters(), fetchMetrics()])
    } catch (e: any) {
      setError(e?.message || 'Failed to load shared data')
    } finally {
      setLoading(false)
    }
  }, [fetchChatters, fetchMetrics])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const loadChatters = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      await fetchChatters()
    } catch (e: any) {
      setError(e?.message || 'Failed to load chatters')
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchChatters])

  const performanceData = useMemo(() => {
    return metrics
      .map(toChatterPerformance)
      .sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999))
  }, [metrics])

  const updateChatter = useCallback(async (chatterId: number, payload: any) => {
    const res = await api<Chatter>(`/admin/chatters/${chatterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    setChatters(prev => prev.map(c => (c.id === chatterId ? res : c)))
    return res
  }, [])

  const deleteChatter = useCallback(async (chatterId: number, { soft = true }: { soft?: boolean } = {}) => {
    await api(`/admin/chatters/${chatterId}?soft=${soft ? 'true' : 'false'}`, {
      method: 'DELETE',
    })
    setChatters(prev => prev.filter(c => c.id !== chatterId))
    try {
      await fetchMetrics()
    } catch (err) {
      console.error('Failed to refresh dashboard metrics after deleting chatter', err)
    }
  }, [fetchMetrics])

  return {
    chatters,
    performanceData,
    loading,
    error,
    loadChatters,
    updateChatter,
    deleteChatter,
    reloadAll: loadAll,
  }
}
