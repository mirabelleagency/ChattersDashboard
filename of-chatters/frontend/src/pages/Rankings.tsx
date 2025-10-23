import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, Button, Badge } from '../components'

export default function Rankings() {
  const [metric, setMetric] = useState('sph')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const metrics = [
    { value: 'sph', label: 'Sales Per Hour', icon: '💰' },
    { value: 'sales_amount', label: 'Total Sales', icon: '💵' },
    { value: 'conversion_rate', label: 'Conversion Rate', icon: '📊' },
  ]

  async function fetchData(){
    setLoading(true)
    try {
      const qs = new URLSearchParams({metric, limit: '20'})
      if (start) qs.set('start', start)
      if (end) qs.set('end', end)
      const data = await api('/performance/rankings?' + qs.toString())
      setRows(data)
    } catch (error) {
      console.error('Failed to load rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ fetchData() },[])

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white'
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-500 text-white'
    return 'bg-gray-100 text-gray-700'
  }

  const formatValue = (value: any) => {
    if (typeof value === 'number') {
      if (metric === 'conversion_rate') return `${(value * 100).toFixed(1)}%`
      if (metric === 'sales_amount') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      return `$${value.toFixed(2)}`
    }
    return value
  }

  const selectedMetric = metrics.find(m => m.value === metric)

  return (
    <div className="space-y-6">
      {/* Header with Metric Selection */}
      <div>
        <p className="text-gray-500 mb-4">Top performers ranked by selected metric</p>
        
        <div className="flex flex-wrap gap-3 mb-6">
          {metrics.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                metric === m.value
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={start}
              onChange={e=>setStart(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={end}
              onChange={e=>setEnd(e.target.value)}
            />
          </div>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Update Rankings'}
          </Button>
        </div>
      </Card>

      {/* Rankings List */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No rankings data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r:any, index) => (
              <div
                key={r.chatter_id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                  index < 3 ? 'bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Rank Badge */}
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${getMedalColor(r.rank)}`}>
                  {r.rank <= 3 ? (
                    <span>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    <span>{r.rank}</span>
                  )}
                </div>

                {/* Chatter Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{r.chatter_name}</h3>
                  <p className="text-sm text-gray-500">{r.team_name || 'No Team'}</p>
                </div>

                {/* Metric Badge */}
                <div className="text-right">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg ${
                    r.rank <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                  }`}>
                    <span>{selectedMetric?.icon}</span>
                    <span>{formatValue(r.value)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
