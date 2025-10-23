import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, Button, Badge } from '../components'

interface Offense { id:number; chatter_id:number; offense_type?:string; offense?:string; offense_date?:string; details?:string; sanction?:string }

export default function Offenses(){
  const [rows, setRows] = useState<Offense[]>([])
  const [payload, setPayload] = useState<any>({ chatter_id:'', offense_date:'' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load(){
    setLoading(true)
    try {
      const data = await api<Offense[]>('/admin/offenses/')
      setRows(data)
    } catch (error) {
      console.error('Failed to load offenses:', error)
    } finally {
      setLoading(false)
    }
  }

  async function create(){
    try {
      const body:any = { ...payload, chatter_id: Number(payload.chatter_id) }
      const off = await api<Offense>('/admin/offenses/', { method:'POST', body: JSON.stringify(body) })
      setRows([off, ...rows])
      setPayload({ chatter_id:'', offense_date:'' })
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to create offense:', error)
    }
  }

  useEffect(()=>{ load() },[])

  function fld(name:string, label:string, type:string='text'){
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <input 
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
          type={type} 
          value={payload[name] ?? ''} 
          onChange={e=>setPayload({...payload, [name]: e.target.value})} 
          placeholder={label}
        />
      </div>
    )
  }

  function getTypeBadgeVariant(type?: string): 'danger' | 'warning' | 'default' {
    if (!type) return 'default'
    const t = type.toLowerCase()
    if (t.includes('major') || t.includes('critical') || t.includes('severe')) return 'danger'
    if (t.includes('minor') || t.includes('warning')) return 'warning'
    return 'default'
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-500">Track and manage chatter offenses and disciplinary actions</p>

      {/* Add Form */}
      <Card 
        title="Record Offense" 
        action={
          <Button variant="ghost" onClick={()=>setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Offense'}
          </Button>
        }
      >
        {showAddForm ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fld('chatter_id', 'Chatter ID')}
              {fld('offense_date', 'Offense Date', 'date')}
              {fld('offense_type', 'Offense Type')}
              {fld('offense', 'Offense Description')}
              {fld('details', 'Details')}
              {fld('sanction', 'Sanction')}
            </div>
            <Button onClick={create} disabled={!payload.chatter_id || !payload.offense_date}>
              Create Offense Record
            </Button>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Click "+ Add Offense" to record a new offense</p>
        )}
      </Card>

      {/* Offenses List */}
      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">Loading offenses...</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <span className="text-4xl mb-3 block">🎉</span>
            <p className="text-gray-500">No offenses recorded</p>
          </div>
        </Card>
      ) : (
        <Card title={`Offenses (${rows.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chatter</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offense</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sanction</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {r.offense_date ? new Date(r.offense_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {r.chatter_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.offense_type ? (
                        <Badge variant={getTypeBadgeVariant(r.offense_type)}>
                          {r.offense_type}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {r.offense || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {r.details || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {r.sanction || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{rows.length}</div>
              <div className="text-sm text-gray-500 mt-1">Total Offenses</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {new Set(rows.map(r => r.chatter_id)).size}
              </div>
              <div className="text-sm text-gray-500 mt-1">Unique Chatters</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {rows.filter(r => r.offense_date && new Date(r.offense_date).getMonth() === new Date().getMonth()).length}
              </div>
              <div className="text-sm text-gray-500 mt-1">This Month</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
