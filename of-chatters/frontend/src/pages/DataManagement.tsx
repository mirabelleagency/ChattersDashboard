import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Button, Badge } from '../components'
import { api, getToken } from '../lib/api'
import type { Chatter } from '../hooks/useSharedData'

const TABS = [
  { key: 'chatters', label: 'Chatters' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'performance', label: 'Performance' },
  { key: 'dashboardMetrics', label: 'Dashboard Metrics' },
  { key: 'offenses', label: 'Misconduct' },
  { key: 'audit', label: 'Audit Logs' },
  { key: 'imports', label: 'Bulk Import / Export' },
] as const

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

interface ShiftRow {
  id: number
  chatter_id: number
  team_id?: number | null
  shift_date: string
  scheduled_hours?: number | null
  actual_hours?: number | null
  remarks?: string | null
}

interface PerformanceRow {
  id: number
  chatter_id: number
  team_id?: number | null
  shift_date: string
  sales_amount?: number | null
  sold_count?: number | null
  retention_count?: number | null
  unlock_count?: number | null
  total_sales?: number | null
  sph?: number | null
  art_interval?: string | null
  golden_ratio?: number | null
  hinge_top_up?: number | null
  tricks_tsf?: number | null
  conversion_rate?: number | null
  unlock_ratio?: number | null
}

interface DashboardMetricRow {
  chatter_name: string
  total_sales: number
  worked_hours: number
  start_date: string | null
  end_date: string | null
  sph: number
  art: string | null
  gr: number
  ur: number
  ranking: number
  shift: string | null
}

interface OffenseRow {
  id: number
  chatter_id: number
  offense_type?: string | null
  offense?: string | null
  offense_date?: string | null
  details?: string | null
  sanction?: string | null
}

interface AuditLogEntry {
  id: number
  occurred_at: string
  user_id?: number | null
  user_email?: string | null
  action: string
  entity: string
  entity_id?: string | null
  before_json?: Record<string, unknown> | null
  after_json?: Record<string, unknown> | null
  ip?: string | null
  user_agent?: string | null
}

type TabKey = typeof TABS[number]['key']

type ChatterFormState = {
  id?: number
  name: string
  handle: string
  email: string
  phone: string
  team_name: string
  external_id: string
  is_active: boolean
}

type ShiftFormState = {
  id?: number
  chatter_id: string
  shift_date: string
  scheduled_hours: string
  actual_hours: string
  remarks: string
}

type PerformanceFormState = {
  id?: number
  chatter_id: string
  shift_date: string
  sales_amount: string
  sold_count: string
  retention_count: string
  unlock_count: string
  total_sales: string
  sph: string
}

type OffenseFormState = {
  id?: number
  chatter_id: string
  offense_type: string
  offense: string
  offense_date: string
  details: string
  sanction: string
}

function toNumber(value: string): number | undefined {
  if (value === '') return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

function exportAsCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    return
  }
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  rows.forEach(row => {
    const cols = headers.map(key => {
      const raw = row[key]
      if (raw === null || raw === undefined) return ''
      if (typeof raw === 'object') {
        return JSON.stringify(raw).replace(/"/g, '""')
      }
      const str = String(raw)
      if (str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    lines.push(cols.join(','))
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState<TabKey>('chatters')
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricRow[]>([])
  const [offenses, setOffenses] = useState<OffenseRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  const [chatterForm, setChatterForm] = useState<ChatterFormState>({
    name: '',
    handle: '',
    email: '',
    phone: '',
    team_name: '',
    external_id: '',
    is_active: true,
  })
  const [shiftForm, setShiftForm] = useState<ShiftFormState>({
    chatter_id: '',
    shift_date: '',
    scheduled_hours: '',
    actual_hours: '',
    remarks: '',
  })
  const [performanceForm, setPerformanceForm] = useState<PerformanceFormState>({
    chatter_id: '',
    shift_date: '',
    sales_amount: '',
    sold_count: '',
    retention_count: '',
    unlock_count: '',
    total_sales: '',
    sph: '',
  })
  const [offenseForm, setOffenseForm] = useState<OffenseFormState>({
    chatter_id: '',
    offense_type: '',
    offense: '',
    offense_date: '',
    details: '',
    sanction: '',
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [auditEntity, setAuditEntity] = useState('')
  const [auditAction, setAuditAction] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkResult, setBulkResult] = useState<any>(null)
  const [selectedChatterIds, setSelectedChatterIds] = useState<number[]>([])
  const selectAllChattersRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setError('')
    setLoading(true)
    const fetchData = async () => {
      try {
        if (activeTab === 'chatters') {
          const rows = await api<Chatter[]>('/admin/chatters')
          setChatters(rows)
        } else if (activeTab === 'shifts') {
          const rows = await api<ShiftRow[]>('/admin/shifts')
          setShifts(rows)
        } else if (activeTab === 'performance') {
          const params = new URLSearchParams()
          if (startDate) params.append('start', startDate)
          if (endDate) params.append('end', endDate)
          const rows = await api<PerformanceRow[]>(`/admin/performance${params.toString() ? `?${params.toString()}` : ''}`)
          setPerformanceRows(rows)
        } else if (activeTab === 'dashboardMetrics') {
          const params = new URLSearchParams()
          if (startDate) params.append('start', startDate)
          if (endDate) params.append('end', endDate)
          const rows = await api<DashboardMetricRow[]>(`/admin/dashboard-metrics/summary${params.toString() ? `?${params.toString()}` : ''}`)
          setDashboardMetrics(rows)
        } else if (activeTab === 'offenses') {
          const rows = await api<OffenseRow[]>(`/admin/offenses/`)
          setOffenses(rows)
        } else if (activeTab === 'audit') {
          const params = new URLSearchParams()
          if (startDate) params.append('start', `${startDate}T00:00:00`)
          if (endDate) params.append('end', `${endDate}T23:59:59`)
          if (auditEntity) params.append('entity', auditEntity)
          if (auditAction) params.append('action', auditAction)
          const rows = await api<AuditLogEntry[]>(`/admin/audit/logs${params.toString() ? `?${params.toString()}` : ''}`)
          setAuditLogs(rows)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [activeTab, startDate, endDate, auditEntity, auditAction])

  useEffect(() => {
    setSelectedChatterIds(prev => {
      const remaining = prev.filter(id => chatters.some(ch => ch.id === id))
      return remaining.length === prev.length ? prev : remaining
    })
  }, [chatters])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(''), 2000)
    return () => clearTimeout(timer)
  }, [success])

  const filteredChatters = useMemo(() => {
    if (!searchTerm) return chatters
    return chatters.filter(ch => ch.name.toLowerCase().includes(searchTerm.toLowerCase()) || (ch.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
  }, [chatters, searchTerm])

  const allVisibleChattersSelected = useMemo(() => {
    if (!filteredChatters.length) return false
    return filteredChatters.every(ch => selectedChatterIds.includes(ch.id))
  }, [filteredChatters, selectedChatterIds])

  const someVisibleChattersSelected = useMemo(() => {
    if (!filteredChatters.length) return false
    return filteredChatters.some(ch => selectedChatterIds.includes(ch.id))
  }, [filteredChatters, selectedChatterIds])

  useEffect(() => {
    if (selectAllChattersRef.current) {
      selectAllChattersRef.current.indeterminate = !allVisibleChattersSelected && someVisibleChattersSelected
    }
  }, [allVisibleChattersSelected, someVisibleChattersSelected])

  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      const matchesSearch = !searchTerm || shift.remarks?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDate = (() => {
        if (!startDate && !endDate) return true
        const shiftDate = shift.shift_date ? new Date(shift.shift_date).getTime() : NaN
        const start = startDate ? new Date(startDate).getTime() : undefined
        const end = endDate ? new Date(endDate).getTime() : undefined
        if (Number.isNaN(shiftDate)) return true
        if (start && shiftDate < start) return false
        if (end && shiftDate > end) return false
        return true
      })()
      return matchesSearch && matchesDate
    })
  }, [shifts, searchTerm, startDate, endDate])

  const filteredPerformance = useMemo(() => {
    return performanceRows.filter(row => {
      const matchesSearch = !searchTerm || String(row.chatter_id).includes(searchTerm)
      const matchesDate = (() => {
        if (!startDate && !endDate) return true
        const rowDate = row.shift_date ? new Date(row.shift_date).getTime() : NaN
        const start = startDate ? new Date(startDate).getTime() : undefined
        const end = endDate ? new Date(endDate).getTime() : undefined
        if (Number.isNaN(rowDate)) return true
        if (start && rowDate < start) return false
        if (end && rowDate > end) return false
        return true
      })()
      return matchesSearch && matchesDate
    })
  }, [performanceRows, searchTerm, startDate, endDate])

  const filteredDashboardMetrics = useMemo(() => {
    const lookup = searchTerm.trim().toLowerCase()
    return dashboardMetrics.filter(row => {
      const matchesSearch = !lookup || row.chatter_name.toLowerCase().includes(lookup) || (row.shift || '').toLowerCase().includes(lookup)
      const matchesDate = (() => {
        if (!startDate && !endDate) return true
        const rangeStart = row.start_date ? new Date(row.start_date).getTime() : undefined
        const rangeEnd = row.end_date ? new Date(row.end_date).getTime() : rangeStart
        const filterStart = startDate ? new Date(startDate).getTime() : undefined
        const filterEnd = endDate ? new Date(endDate).getTime() : undefined
        if (rangeStart === undefined && rangeEnd === undefined) return true
        const effectiveStart = rangeStart ?? rangeEnd
        const effectiveEnd = rangeEnd ?? rangeStart
        if (filterStart && effectiveEnd !== undefined && effectiveEnd < filterStart) return false
        if (filterEnd && effectiveStart !== undefined && effectiveStart > filterEnd) return false
        return true
      })()
      return matchesSearch && matchesDate
    })
  }, [dashboardMetrics, searchTerm, startDate, endDate])

  const dashboardMetricsSummary = useMemo(() => {
    if (!filteredDashboardMetrics.length) {
      return null
    }
    const totals = filteredDashboardMetrics.reduce(
      (acc, row) => {
        acc.totalSales += row.total_sales ?? 0
        acc.workedHours += row.worked_hours ?? 0
        acc.sph += row.sph ?? 0
        acc.gr += row.gr ?? 0
        acc.ur += row.ur ?? 0
        return acc
      },
      { totalSales: 0, workedHours: 0, sph: 0, gr: 0, ur: 0 }
    )
    const count = filteredDashboardMetrics.length
    return {
      totalSales: totals.totalSales,
      workedHours: totals.workedHours,
      avgSph: totals.sph / count,
      avgGr: totals.gr / count,
      avgUr: totals.ur / count,
    }
  }, [filteredDashboardMetrics])

  const filteredOffenses = useMemo(() => {
    return offenses.filter(off => {
      const matchesSearch = !searchTerm || (off.offense || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDate = (() => {
        if (!startDate && !endDate) return true
        const offDate = off.offense_date ? new Date(off.offense_date).getTime() : NaN
        const start = startDate ? new Date(startDate).getTime() : undefined
        const end = endDate ? new Date(endDate).getTime() : undefined
        if (Number.isNaN(offDate)) return true
        if (start && offDate < start) return false
        if (end && offDate > end) return false
        return true
      })()
      return matchesSearch && matchesDate
    })
  }, [offenses, searchTerm, startDate, endDate])

  const toggleChatterSelection = (id: number) => {
    setSelectedChatterIds(prev => (prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]))
  }

  const handleSelectAllChatters = () => {
    if (!filteredChatters.length) return
    setSelectedChatterIds(prev => {
      const visibleIds = filteredChatters.map(ch => ch.id)
      const allSelected = visibleIds.every(id => prev.includes(id))
      if (allSelected) {
        return prev.filter(id => !visibleIds.includes(id))
      }
      const next = new Set(prev)
      visibleIds.forEach(id => next.add(id))
      return Array.from(next)
    })
  }

  async function handleBulkDeleteChatters() {
    if (!selectedChatterIds.length) return
    const count = selectedChatterIds.length
    if (!window.confirm(`Delete ${count} selected chatter${count === 1 ? '' : 's'}? This action cannot be undone.`)) return
    const ids = [...selectedChatterIds]
    try {
      setLoading(true)
      for (const id of ids) {
        await api(`/admin/chatters/${id}?soft=false`, { method: 'DELETE' })
      }
      setChatters(prev => prev.filter(ch => !ids.includes(ch.id)))
      setSelectedChatterIds([])
      setSuccess(count === 1 ? 'Chatter deleted' : `${count} chatters deleted`)
    } catch (err: any) {
      setError(err.message || 'Failed to delete selected chatters')
      try {
        const rows = await api<Chatter[]>('/admin/chatters')
        setChatters(rows)
      } catch {
        // ignore refresh errors; stale data will be retried on next load
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForms = () => {
    setChatterForm({ name: '', handle: '', email: '', phone: '', team_name: '', external_id: '', is_active: true })
    setShiftForm({ chatter_id: '', shift_date: '', scheduled_hours: '', actual_hours: '', remarks: '' })
    setPerformanceForm({ chatter_id: '', shift_date: '', sales_amount: '', sold_count: '', retention_count: '', unlock_count: '', total_sales: '', sph: '' })
    setOffenseForm({ chatter_id: '', offense_type: '', offense: '', offense_date: '', details: '', sanction: '' })
  }

  async function handleSaveChatter() {
    try {
      setLoading(true)
      const payload: any = {
        name: chatterForm.name,
        handle: chatterForm.handle || undefined,
        email: chatterForm.email || undefined,
        phone: chatterForm.phone || undefined,
        team_name: chatterForm.team_name || undefined,
        external_id: chatterForm.external_id || undefined,
        is_active: chatterForm.is_active,
      }
      if (chatterForm.id) {
        await api(`/admin/chatters/${chatterForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setSuccess('Chatter updated')
      } else {
        await api('/admin/chatters', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('Chatter created')
      }
      const rows = await api<Chatter[]>('/admin/chatters')
      setChatters(rows)
      resetForms()
    } catch (err: any) {
      setError(err.message || 'Failed to save chatter')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteChatter(id: number) {
    if (!window.confirm('Delete this chatter? This action cannot be undone.')) return
    try {
      setLoading(true)
      await api(`/admin/chatters/${id}?soft=false`, { method: 'DELETE' })
      setChatters(prev => prev.filter(ch => ch.id !== id))
      setSelectedChatterIds(prev => prev.filter(selectedId => selectedId !== id))
      setSuccess('Chatter deleted')
    } catch (err: any) {
      setError(err.message || 'Failed to delete chatter')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveShift() {
    try {
      setLoading(true)
      const payload: any = {
        chatter_id: Number(shiftForm.chatter_id),
        shift_date: shiftForm.shift_date,
        scheduled_hours: toNumber(shiftForm.scheduled_hours),
        actual_hours: toNumber(shiftForm.actual_hours),
        remarks: shiftForm.remarks || undefined,
      }
      if (shiftForm.id) {
        await api(`/admin/shifts/${shiftForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setSuccess('Shift updated')
      } else {
        await api('/admin/shifts/', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('Shift created')
      }
      const rows = await api<ShiftRow[]>('/admin/shifts')
      setShifts(rows)
      setShiftForm({ chatter_id: '', shift_date: '', scheduled_hours: '', actual_hours: '', remarks: '' })
    } catch (err: any) {
      setError(err.message || 'Failed to save shift')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteShift(id: number) {
    if (!window.confirm('Delete this shift record?')) return
    try {
      setLoading(true)
      await api(`/admin/shifts/${id}?soft=false`, { method: 'DELETE' })
      setShifts(prev => prev.filter(shift => shift.id !== id))
      setSuccess('Shift deleted')
    } catch (err: any) {
      setError(err.message || 'Failed to delete shift')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePerformance() {
    try {
      setLoading(true)
      const payload: any = {
        chatter_id: Number(performanceForm.chatter_id),
        shift_date: performanceForm.shift_date,
        sales_amount: toNumber(performanceForm.sales_amount),
        sold_count: toNumber(performanceForm.sold_count),
        retention_count: toNumber(performanceForm.retention_count),
        unlock_count: toNumber(performanceForm.unlock_count),
        total_sales: toNumber(performanceForm.total_sales),
        sph: toNumber(performanceForm.sph),
      }
      await api('/admin/performance', { method: 'POST', body: JSON.stringify(payload) })
      const params = new URLSearchParams()
      if (startDate) params.append('start', startDate)
      if (endDate) params.append('end', endDate)
      const rows = await api<PerformanceRow[]>(`/admin/performance${params.toString() ? `?${params.toString()}` : ''}`)
      setPerformanceRows(rows)
      setPerformanceForm({ chatter_id: '', shift_date: '', sales_amount: '', sold_count: '', retention_count: '', unlock_count: '', total_sales: '', sph: '' })
      setSuccess('Performance saved')
    } catch (err: any) {
      setError(err.message || 'Failed to save performance data')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePerformance(id: number) {
    if (!window.confirm('Delete this performance record?')) return
    try {
      setLoading(true)
      await api(`/admin/performance/${id}?soft=false`, { method: 'DELETE' })
      setPerformanceRows(prev => prev.filter(row => row.id !== id))
      setSuccess('Performance record deleted')
    } catch (err: any) {
      setError(err.message || 'Failed to delete performance record')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveOffense() {
    try {
      setLoading(true)
      const payload: any = {
        chatter_id: Number(offenseForm.chatter_id),
        offense_type: offenseForm.offense_type || undefined,
        offense: offenseForm.offense || undefined,
        offense_date: offenseForm.offense_date || undefined,
        details: offenseForm.details || undefined,
        sanction: offenseForm.sanction || undefined,
      }
      if (offenseForm.id) {
        await api(`/admin/offenses/${offenseForm.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setSuccess('Misconduct updated')
      } else {
        await api('/admin/offenses/', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('Misconduct recorded')
      }
      const rows = await api<OffenseRow[]>('/admin/offenses/')
      setOffenses(rows)
      setOffenseForm({ chatter_id: '', offense_type: '', offense: '', offense_date: '', details: '', sanction: '' })
    } catch (err: any) {
      setError(err.message || 'Failed to save misconduct')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteOffense(id: number) {
    if (!window.confirm('Delete this misconduct record?')) return
    try {
      setLoading(true)
      await api(`/admin/offenses/${id}?soft=false`, { method: 'DELETE' })
      setOffenses(prev => prev.filter(off => off.id !== id))
      setSuccess('Misconduct removed')
    } catch (err: any) {
      setError(err.message || 'Failed to delete misconduct')
    } finally {
      setLoading(false)
    }
  }

  async function handleBulkUpload() {
    if (!bulkFile) {
      setError('Please select a file to upload')
      return
    }
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', bulkFile)
      const headers: Record<string, string> = {}
      const token = getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/admin/import/excel`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Bulk upload failed')
      }
      const body = await res.json()
      setBulkResult(body)
      setSuccess('Bulk upload completed')
    } catch (err: any) {
      setError(err.message || 'Bulk upload failed')
    } finally {
      setLoading(false)
    }
  }

  const renderChatters = () => (
    <Card title="Chatters">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600">Name</label>
                <input type="text" value={chatterForm.name} onChange={e => setChatterForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Handle</label>
                <input type="text" value={chatterForm.handle} onChange={e => setChatterForm(prev => ({ ...prev, handle: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Email</label>
                <input type="email" value={chatterForm.email} onChange={e => setChatterForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Phone</label>
                <input type="text" value={chatterForm.phone} onChange={e => setChatterForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Team</label>
                <input type="text" value={chatterForm.team_name} onChange={e => setChatterForm(prev => ({ ...prev, team_name: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">External ID</label>
                <input type="text" value={chatterForm.external_id} onChange={e => setChatterForm(prev => ({ ...prev, external_id: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="chatter-active" type="checkbox" checked={chatterForm.is_active} onChange={e => setChatterForm(prev => ({ ...prev, is_active: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="chatter-active" className="text-sm text-gray-600">Active</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveChatter} disabled={loading || !chatterForm.name}>{chatterForm.id ? 'Update' : 'Create'} Chatter</Button>
              <Button variant="secondary" onClick={() => setChatterForm({ name: '', handle: '', email: '', phone: '', team_name: '', external_id: '', is_active: true })} disabled={loading}>Clear</Button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{selectedChatterIds.length ? `${selectedChatterIds.length} selected` : ' '}</span>
              <Button variant="danger" size="sm" onClick={handleBulkDeleteChatters} disabled={loading || !selectedChatterIds.length}>
                Delete Selected
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-center">
                      <input
                        ref={selectAllChattersRef}
                        type="checkbox"
                        checked={allVisibleChattersSelected}
                        onChange={handleSelectAllChatters}
                        disabled={!filteredChatters.length || loading}
                        aria-label="Select all chatters in view"
                        className="h-4 w-4 mx-auto"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Team</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredChatters.map(ch => {
                    const isSelected = selectedChatterIds.includes(ch.id)
                    return (
                      <tr key={ch.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleChatterSelection(ch.id)}
                            disabled={loading}
                            aria-label={`Select chatter ${ch.name}`}
                            className="h-4 w-4 mx-auto"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm">{ch.name}</td>
                        <td className="px-4 py-2 text-sm">{ch.email || '-'}</td>
                        <td className="px-4 py-2 text-sm">{ch.team_name || '-'}</td>
                        <td className="px-4 py-2">
                          <Badge variant={ch.is_active ? 'success' : 'default'}>{ch.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="px-4 py-2 text-center space-x-2">
                          <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => setChatterForm({
                            id: ch.id,
                            name: ch.name,
                            handle: ch.handle || '',
                            email: ch.email || '',
                            phone: ch.phone || '',
                            team_name: ch.team_name || '',
                            external_id: ch.external_id || '',
                            is_active: ch.is_active,
                          })}>Edit</button>
                          <button className="text-red-600 hover:text-red-800 text-sm" onClick={() => handleDeleteChatter(ch.id)}>Delete</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )

  const renderDashboardMetrics = () => (
    <Card title="Dashboard Metrics">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">Metrics below are computed directly from performance data and shift records for the selected date range. Update those datasets to change what appears on the dashboard.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs font-semibold uppercase text-blue-700">Total Sales</div>
            <div className="text-2xl font-bold text-blue-900">{dashboardMetricsSummary ? dashboardMetricsSummary.totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase text-emerald-700">Worked Hours</div>
            <div className="text-2xl font-bold text-emerald-900">{dashboardMetricsSummary ? dashboardMetricsSummary.workedHours.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</div>
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
            <div className="text-xs font-semibold uppercase text-purple-700">Average SPH</div>
            <div className="text-2xl font-bold text-purple-900">{dashboardMetricsSummary ? dashboardMetricsSummary.avgSph.toFixed(2) : '—'}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Chatter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Sales</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Worked Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SPH</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">GR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">UR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shift / Team</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Range</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ART</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredDashboardMetrics.map(row => {
                const key = `${row.chatter_name}-${row.ranking}-${row.start_date ?? ''}-${row.end_date ?? ''}`
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">#{row.ranking ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.chatter_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.total_sales != null ? row.total_sales.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.worked_hours != null ? row.worked_hours.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.sph != null ? row.sph.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.gr != null ? `${row.gr.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.ur != null ? `${row.ur.toFixed(2)}%` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.shift || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.start_date || row.end_date ? `${row.start_date ?? '—'} → ${row.end_date ?? '—'}` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.art || '—'}</td>
                  </tr>
                )
              })}
              {!filteredDashboardMetrics.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">No dashboard metrics available for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )

  const renderShifts = () => (
    <Card title="Shifts">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600">Chatter ID</label>
                <input type="number" value={shiftForm.chatter_id} onChange={e => setShiftForm(prev => ({ ...prev, chatter_id: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Shift Date</label>
                <input type="date" value={shiftForm.shift_date} onChange={e => setShiftForm(prev => ({ ...prev, shift_date: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Scheduled Hours</label>
                <input type="number" step="0.25" value={shiftForm.scheduled_hours} onChange={e => setShiftForm(prev => ({ ...prev, scheduled_hours: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Actual Hours</label>
                <input type="number" step="0.25" value={shiftForm.actual_hours} onChange={e => setShiftForm(prev => ({ ...prev, actual_hours: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Remarks</label>
              <textarea value={shiftForm.remarks} onChange={e => setShiftForm(prev => ({ ...prev, remarks: e.target.value }))} className="w-full px-3 py-2 border rounded" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveShift} disabled={loading || !shiftForm.chatter_id || !shiftForm.shift_date}>{shiftForm.id ? 'Update' : 'Create'} Shift</Button>
              <Button variant="secondary" onClick={() => setShiftForm({ chatter_id: '', shift_date: '', scheduled_hours: '', actual_hours: '', remarks: '' })} disabled={loading}>Clear</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Chatter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actual Hrs</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShifts.map(shift => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{shift.chatter_id}</td>
                    <td className="px-4 py-2 text-sm">{shift.shift_date ? new Date(shift.shift_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">{shift.actual_hours ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{shift.remarks || '-'}</td>
                    <td className="px-4 py-2 text-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => setShiftForm({
                        id: shift.id,
                        chatter_id: String(shift.chatter_id || ''),
                        shift_date: shift.shift_date ? shift.shift_date.substring(0, 10) : '',
                        scheduled_hours: shift.scheduled_hours != null ? String(shift.scheduled_hours) : '',
                        actual_hours: shift.actual_hours != null ? String(shift.actual_hours) : '',
                        remarks: shift.remarks || '',
                      })}>Edit</button>
                      <button className="text-red-600 hover:text-red-800 text-sm" onClick={() => handleDeleteShift(shift.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )

  const renderPerformance = () => (
    <Card title="Performance Records">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600">Chatter ID</label>
                <input type="number" value={performanceForm.chatter_id} onChange={e => setPerformanceForm(prev => ({ ...prev, chatter_id: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Shift Date</label>
                <input type="date" value={performanceForm.shift_date} onChange={e => setPerformanceForm(prev => ({ ...prev, shift_date: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Sales Amount</label>
                <input type="number" step="0.01" value={performanceForm.sales_amount} onChange={e => setPerformanceForm(prev => ({ ...prev, sales_amount: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Sold Count</label>
                <input type="number" value={performanceForm.sold_count} onChange={e => setPerformanceForm(prev => ({ ...prev, sold_count: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Retention Count</label>
                <input type="number" value={performanceForm.retention_count} onChange={e => setPerformanceForm(prev => ({ ...prev, retention_count: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Unlock Count</label>
                <input type="number" value={performanceForm.unlock_count} onChange={e => setPerformanceForm(prev => ({ ...prev, unlock_count: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Total Sales</label>
                <input type="number" step="0.01" value={performanceForm.total_sales} onChange={e => setPerformanceForm(prev => ({ ...prev, total_sales: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">SPH</label>
                <input type="number" step="0.01" value={performanceForm.sph} onChange={e => setPerformanceForm(prev => ({ ...prev, sph: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePerformance} disabled={loading || !performanceForm.chatter_id || !performanceForm.shift_date}>Save Performance</Button>
              <Button variant="secondary" onClick={() => setPerformanceForm({ chatter_id: '', shift_date: '', sales_amount: '', sold_count: '', retention_count: '', unlock_count: '', total_sales: '', sph: '' })} disabled={loading}>Clear</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Chatter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sales</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">SPH</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPerformance.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{row.chatter_id}</td>
                    <td className="px-4 py-2 text-sm">{row.shift_date ? new Date(row.shift_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">{row.sales_amount ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{row.sph ?? '-'}</td>
                    <td className="px-4 py-2 text-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => setPerformanceForm({
                        id: row.id,
                        chatter_id: String(row.chatter_id || ''),
                        shift_date: row.shift_date ? row.shift_date.substring(0, 10) : '',
                        sales_amount: row.sales_amount != null ? String(row.sales_amount) : '',
                        sold_count: row.sold_count != null ? String(row.sold_count) : '',
                        retention_count: row.retention_count != null ? String(row.retention_count) : '',
                        unlock_count: row.unlock_count != null ? String(row.unlock_count) : '',
                        total_sales: row.total_sales != null ? String(row.total_sales) : '',
                        sph: row.sph != null ? String(row.sph) : '',
                      })}>Edit</button>
                      <button className="text-red-600 hover:text-red-800 text-sm" onClick={() => handleDeletePerformance(row.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )

  const renderOffenses = () => (
    <Card title="Misconduct Records">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600">Chatter ID</label>
                <input type="number" value={offenseForm.chatter_id} onChange={e => setOffenseForm(prev => ({ ...prev, chatter_id: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Date</label>
                <input type="date" value={offenseForm.offense_date} onChange={e => setOffenseForm(prev => ({ ...prev, offense_date: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Type</label>
                <input type="text" value={offenseForm.offense_type} onChange={e => setOffenseForm(prev => ({ ...prev, offense_type: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Offense</label>
                <input type="text" value={offenseForm.offense} onChange={e => setOffenseForm(prev => ({ ...prev, offense: e.target.value }))} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Sanction</label>
              <input type="text" value={offenseForm.sanction} onChange={e => setOffenseForm(prev => ({ ...prev, sanction: e.target.value }))} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Details</label>
              <textarea value={offenseForm.details} onChange={e => setOffenseForm(prev => ({ ...prev, details: e.target.value }))} className="w-full px-3 py-2 border rounded" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveOffense} disabled={loading || !offenseForm.chatter_id}>{offenseForm.id ? 'Update' : 'Record'} Misconduct</Button>
              <Button variant="secondary" onClick={() => setOffenseForm({ chatter_id: '', offense_type: '', offense: '', offense_date: '', details: '', sanction: '' })} disabled={loading}>Clear</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Chatter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Offense</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sanction</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOffenses.map(off => (
                  <tr key={off.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{off.chatter_id}</td>
                    <td className="px-4 py-2 text-sm">{off.offense_date ? new Date(off.offense_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">{off.offense || '-'}</td>
                    <td className="px-4 py-2 text-sm">{off.sanction || '-'}</td>
                    <td className="px-4 py-2 text-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => setOffenseForm({
                        id: off.id,
                        chatter_id: String(off.chatter_id || ''),
                        offense_type: off.offense_type || '',
                        offense: off.offense || '',
                        offense_date: off.offense_date ? off.offense_date.substring(0, 10) : '',
                        details: off.details || '',
                        sanction: off.sanction || '',
                      })}>Edit</button>
                      <button className="text-red-600 hover:text-red-800 text-sm" onClick={() => handleDeleteOffense(off.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )

  const renderAuditLogs = () => (
    <Card title="Audit Trail">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500">Entity</label>
            <input type="text" value={auditEntity} onChange={e => setAuditEntity(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="performance_daily" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500">Action</label>
            <input type="text" value={auditAction} onChange={e => setAuditAction(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="upsert" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{new Date(log.occurred_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">{log.entity}</td>
                  <td className="px-4 py-2 text-sm">{log.action}</td>
                  <td className="px-4 py-2 text-sm">{log.user_email || log.user_id || '-'}</td>
                  <td className="px-4 py-2 text-xs whitespace-pre-wrap">
                    {renderAuditDetails(log.before_json, 'Before')}
                    {renderAuditDetails(log.after_json, 'After')}
                    {!log.before_json && !log.after_json && <span>-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )

  const renderBulkTools = () => (
    <Card title="Bulk Import & Export">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Upload Template</h3>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setBulkFile(e.target.files?.[0] ?? null)} className="w-full" />
            <Button onClick={handleBulkUpload} disabled={loading || !bulkFile}>Upload File</Button>
            {bulkResult && (
              <div className="text-sm text-gray-600 border rounded p-3 bg-gray-50">
                <div className="font-medium mb-1">Import Result</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(bulkResult, null, 2)}</pre>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Quick Exports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => exportAsCSV('chatters_export.csv', filteredChatters.map(ch => ({
                id: ch.id,
                name: ch.name,
                email: ch.email,
                team_name: ch.team_name,
                is_active: ch.is_active,
              })))} disabled={!filteredChatters.length}>Export Chatters</Button>
              <Button variant="secondary" onClick={() => exportAsCSV('shifts_export.csv', filteredShifts.map(shift => ({
                id: shift.id,
                chatter_id: shift.chatter_id,
                shift_date: shift.shift_date,
                scheduled_hours: shift.scheduled_hours,
                actual_hours: shift.actual_hours,
                remarks: shift.remarks,
              })))} disabled={!filteredShifts.length}>Export Shifts</Button>
              <Button variant="secondary" onClick={() => exportAsCSV('performance_export.csv', filteredPerformance.map(row => ({
                id: row.id,
                chatter_id: row.chatter_id,
                shift_date: row.shift_date,
                sales_amount: row.sales_amount,
                sold_count: row.sold_count,
                retention_count: row.retention_count,
                unlock_count: row.unlock_count,
                total_sales: row.total_sales,
                sph: row.sph,
              })))} disabled={!filteredPerformance.length}>Export Performance</Button>
              <Button variant="secondary" onClick={() => exportAsCSV('dashboard_metrics_export.csv', filteredDashboardMetrics.map(metric => ({
                ranking: metric.ranking,
                total_sales: metric.total_sales,
                worked_hours: metric.worked_hours,
                start_date: metric.start_date,
                end_date: metric.end_date,
                sph: metric.sph,
                art: metric.art,
                gr: metric.gr,
                ur: metric.ur,
                shift: metric.shift,
              })))} disabled={!filteredDashboardMetrics.length}>Export Dashboard Metrics</Button>
              <Button variant="secondary" onClick={() => exportAsCSV('offenses_export.csv', filteredOffenses.map(off => ({
                id: off.id,
                chatter_id: off.chatter_id,
                offense_type: off.offense_type,
                offense: off.offense,
                offense_date: off.offense_date,
                details: off.details,
                sanction: off.sanction,
              })))} disabled={!filteredOffenses.length}>Export Misconduct</Button>
              <Button variant="secondary" onClick={() => exportAsCSV('audit_logs_export.csv', auditLogs.map(log => ({
                id: log.id,
                occurred_at: log.occurred_at,
                entity: log.entity,
                action: log.action,
                user_id: log.user_id,
                before_json: log.before_json,
                after_json: log.after_json,
              })))} disabled={!auditLogs.length}>Export Audit Logs</Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Management Console</h1>
          <p className="text-gray-500">Admin-only workspace for managing all operational data with full audit tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500">Search</label>
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search records" className="px-3 py-2 border rounded w-56" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 border rounded" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'imports') {
                setSearchTerm('')
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded bg-green-100 text-green-700 text-sm">{success}</div>}

      {loading && <div className="text-sm text-gray-500">Loading data…</div>}

      {!loading && (
        <>
          {activeTab === 'chatters' && renderChatters()}
          {activeTab === 'shifts' && renderShifts()}
          {activeTab === 'performance' && renderPerformance()}
          {activeTab === 'dashboardMetrics' && renderDashboardMetrics()}
          {activeTab === 'offenses' && renderOffenses()}
          {activeTab === 'audit' && renderAuditLogs()}
          {activeTab === 'imports' && renderBulkTools()}
        </>
      )}
    </div>
  )
}

function renderAuditDetails(data: Record<string, unknown> | null | undefined, label: string) {
  if (!data || typeof data !== 'object') {
    return null
  }

  const entries = Object.entries(data)
  if (!entries.length) {
    return null
  }

  const formatted = entries
    .map(([key, value]) => `${key}: ${formatAuditValue(value)}`)
    .join('\n')

  return (
    <div className="mb-2">
      <div className="font-semibold text-gray-600 text-[11px] uppercase">{label}</div>
      <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-[11px] leading-snug text-gray-700">{formatted}</pre>
    </div>
  )
}

function formatAuditValue(input: unknown): string {
  if (input === null || input === undefined) return '—'
  if (Array.isArray(input)) {
    if (!input.length) return '(empty list)'
    return input.map(item => formatAuditValue(item)).join(', ')
  }
  if (typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>)
    if (!entries.length) return '(empty object)'
    return entries.map(([key, value]) => `${key}=${formatAuditValue(value)}`).join(', ')
  }
  return String(input)
}
