import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, Button } from '../components'

interface Shift { id:number; chatter_id:number; shift_date:string; scheduled_hours?:number; actual_hours?:number; remarks?:string }

export default function Shifts(){
  const [rows, setRows] = useState<Shift[]>([])
  const [chatterId, setChatterId] = useState('')
  const [date, setDate] = useState('')
  const [scheduled, setScheduled] = useState('')
  const [actual, setActual] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load(){
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (chatterId) qs.set('chatter_id', chatterId)
      const data = await api<Shift[]>('/admin/shifts/?' + qs.toString())
      setRows(data)
    } catch (error) {
      console.error('Failed to load shifts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function create(){
    const payload:any = { chatter_id: Number(chatterId), shift_date: date }
    if (scheduled) payload.scheduled_hours = Number(scheduled)
    if (actual) payload.actual_hours = Number(actual)
    try {
      const sh = await api<Shift>('/admin/shifts/', { method:'POST', body: JSON.stringify(payload) })
      setRows([sh, ...rows])
      setChatterId('')
      setDate('')
      setScheduled('')
      setActual('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to create shift:', error)
    }
  }

  useEffect(()=>{ load() },[])

  return (
    <div className="space-y-6">
      <p className="text-gray-500">Manage chatter shifts, scheduled and actual hours</p>

      {/* Filters */}
      <Card title="Filters">
        <div className="flex gap-3">
          <input 
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
            placeholder="Filter by Chatter ID" 
            value={chatterId} 
            onChange={e=>setChatterId(e.target.value)} 
          />
          <Button onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Filter'}
          </Button>
          <Button onClick={()=>{ setChatterId(''); load() }} variant="ghost">
            Clear
          </Button>
        </div>
      </Card>

      {/* Add Form */}
      <Card 
        title="Add New Shift" 
        action={
          <Button variant="ghost" onClick={()=>setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add Shift'}
          </Button>
        }
      >
        {showAddForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chatter ID</label>
                <input 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="Chatter ID" 
                  value={chatterId} 
                  onChange={e=>setChatterId(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shift Date</label>
                <input 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  type="date" 
                  value={date} 
                  onChange={e=>setDate(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Hours</label>
                <input 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="Scheduled hrs" 
                  value={scheduled} 
                  onChange={e=>setScheduled(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actual Hours</label>
                <input 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  placeholder="Actual hrs" 
                  value={actual} 
                  onChange={e=>setActual(e.target.value)} 
                />
              </div>
            </div>
            <Button onClick={create}>Create Shift</Button>
          </div>
        )}
        {!showAddForm && (
          <p className="text-gray-500 text-sm">Click "Add Shift" to create a new shift entry</p>
        )}
      </Card>

      {/* Shifts List */}
      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">Loading shifts...</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-gray-500">No shifts found</div>
        </Card>
      ) : (
        <Card title={`Shifts (${rows.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chatter ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => {
                  const variance = (r.actual_hours && r.scheduled_hours) 
                    ? r.actual_hours - r.scheduled_hours 
                    : null
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.shift_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.chatter_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.scheduled_hours ?? '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.actual_hours ?? '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {variance !== null ? (
                          <span className={variance >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
