import { useState } from 'react'
import { api } from '../lib/api'
import { Card, Button } from '../components'

export default function Performance(){
  const [payload, setPayload] = useState<any>({ chatter_id:'', shift_date:'' })
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(){
    setLoading(true)
    setStatus(null)
    try {
      const body:any = { ...payload }
      body.chatter_id = Number(body.chatter_id)
      if (body.sales_amount) body.sales_amount = Number(body.sales_amount)
      if (body.sold_count) body.sold_count = Number(body.sold_count)
      if (body.retention_count) body.retention_count = Number(body.retention_count)
      if (body.unlock_count) body.unlock_count = Number(body.unlock_count)
      if (body.sph) body.sph = Number(body.sph)
      const res = await api('/admin/performance', { method:'POST', body: JSON.stringify(body) })
      setStatus({ type: 'success', message: `Performance saved successfully (ID: ${res.id})` })
      setPayload({ chatter_id:'', shift_date:'' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Failed to save performance' })
    } finally {
      setLoading(false)
    }
  }

  function fld(name:string, label:string, type: string = 'text'){
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

  return (
    <div className="space-y-6">
      <p className="text-gray-500">Record or update performance metrics for a chatter on a specific date</p>

      <Card title="Performance Entry">
        <div className="space-y-6">
          {/* Identification */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Identification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fld('chatter_id', 'Chatter ID')}
              {fld('shift_date', 'Shift Date', 'date')}
            </div>
          </div>

          {/* Sales Metrics */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Sales Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fld('sales_amount', 'Sales Amount ($)')}
              {fld('sold_count', 'Sold Count')}
              {fld('sph', 'Sales Per Hour (SPH)')}
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">📊 Engagement Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fld('retention_count', 'Retention Count')}
              {fld('unlock_count', 'Unlock Count')}
              {fld('art_interval', 'ART Interval')}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t flex gap-3">
            <Button onClick={submit} disabled={loading || !payload.chatter_id || !payload.shift_date}>
              {loading ? 'Saving...' : 'Save Performance'}
            </Button>
            <Button variant="ghost" onClick={()=>setPayload({ chatter_id:'', shift_date:'' })}>
              Clear Form
            </Button>
          </div>

          {/* Status Message */}
          {status && (
            <div className={`p-4 rounded-lg ${
              status.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{status.type === 'success' ? '✅' : '❌'}</span>
                <span>{status.message}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Info Box */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">How it works</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• This form creates or updates performance metrics for a chatter</li>
              <li>• Both Chatter ID and Shift Date are required</li>
              <li>• If a record exists for this chatter + date, it will be updated</li>
              <li>• Leave optional fields blank if not applicable</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
