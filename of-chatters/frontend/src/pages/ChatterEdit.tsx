import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Card } from '../components'
import { useSharedDataContext } from '../contexts/SharedDataContext'
import type { Chatter } from '../hooks/useSharedData'

export default function ChatterEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const chatterId = Number(id)
  const { updateChatter } = useSharedDataContext()

  const [model, setModel] = useState<Chatter | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [offenses, setOffenses] = useState<any[]>([])
  const [offenseForm, setOffenseForm] = useState({
    offense_type: '',
    offense: '',
    offense_date: '',
    details: '',
    sanction: ''
  })

  useEffect(() => { load() }, [chatterId])

  async function load() {
    try {
      setLoading(true)
      const found = await api<Chatter>(`/admin/chatters/${chatterId}`)
      setModel(found)
      try {
        const offs = await api<any[]>(`/offenses?chatter_id=${chatterId}`)
        setOffenses(offs)
      } catch {}
    } catch (e: any) {
      setError(e.message || 'Failed to load details')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!model) return
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const payload: any = {
        external_id: model.external_id || undefined,
        name: model.name,
        handle: model.handle || undefined,
        email: model.email || undefined,
        phone: model.phone || undefined,
        team_name: model.team_name || undefined,
        is_active: model.is_active,
      }
      const res = await updateChatter(model.id, payload)
      setModel(res)
      setSuccess('Saved')
      setTimeout(() => setSuccess(''), 1500)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function addOffense() {
    if (!model) return
    try {
      setSaving(true)
      setError('')
      const payload = {
        chatter_id: model.id,
        offense_type: offenseForm.offense_type || undefined,
        offense: offenseForm.offense || undefined,
        offense_date: offenseForm.offense_date || undefined,
        details: offenseForm.details || undefined,
        sanction: offenseForm.sanction || undefined,
      }
      const created = await api<any>(`/offenses/`, { method: 'POST', body: JSON.stringify(payload) })
      setOffenses([created, ...offenses])
      setOffenseForm({ offense_type: '', offense: '', offense_date: '', details: '', sanction: '' })
      setSuccess('Misconduct recorded')
      setTimeout(() => setSuccess(''), 1500)
    } catch (e: any) {
      setError(e.message || 'Failed to record misconduct')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Chatter</h2>
          <button onClick={() => navigate('/chatters')} className="text-sm text-gray-600 hover:text-gray-800">Back to list</button>
        </div>
        <Card><div className="p-6 text-sm text-red-600">{error}</div></Card>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Chatter</h2>
          <button onClick={() => navigate('/chatters')} className="text-sm text-gray-600 hover:text-gray-800">Back to list</button>
        </div>
        <Card><div className="p-6 text-sm text-gray-500">No data</div></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Edit Chatter</h2>
        <button onClick={() => navigate('/chatters')} className="text-sm text-gray-600 hover:text-gray-800">Back to list</button>
      </div>

      <Card>
        <div className="p-6 space-y-8">
          {success && <div className="text-sm text-green-600">{success}</div>}
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-3">Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unique ID</label>
                <input
                  type="text"
                  value={model.external_id || ''}
                  onChange={(e) => setModel({ ...model, external_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., CH-001 or unique identifier"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={model.name}
                  onChange={(e) => setModel({ ...model, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                <input
                  type="text"
                  value={model.handle || ''}
                  onChange={(e) => setModel({ ...model, handle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={model.email || ''}
                  onChange={(e) => setModel({ ...model, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={model.phone || ''}
                  onChange={(e) => setModel({ ...model, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <input
                  type="text"
                  value={model.team_name || ''}
                  onChange={(e) => setModel({ ...model, team_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={!!model.is_active}
                  onChange={(e) => setModel({ ...model, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-3">Misconduct</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of offense</label>
                <select
                  value={offenseForm.offense_type}
                  onChange={(e) => setOffenseForm({ ...offenseForm, offense_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select...</option>
                  <option>Security</option>
                  <option>Code of Conduct</option>
                  <option>Attendance</option>
                  <option>Data Privacy</option>
                  <option>Harassment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offense</label>
                <input
                  type="text"
                  value={offenseForm.offense}
                  onChange={(e) => setOffenseForm({ ...offenseForm, offense: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., 1st offense (serious)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={offenseForm.offense_date}
                  onChange={(e) => setOffenseForm({ ...offenseForm, offense_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sanction</label>
                <input
                  type="text"
                  value={offenseForm.sanction}
                  onChange={(e) => setOffenseForm({ ...offenseForm, sanction: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Verbal warning or 7 days suspension"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  value={offenseForm.details}
                  onChange={(e) => setOffenseForm({ ...offenseForm, details: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Describe what happened"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  onClick={addOffense}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Record Misconduct'}
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Offense</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sanction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {offenses.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2">{o.offense_type || '-'}</td>
                      <td className="px-4 py-2">{o.offense || '-'}</td>
                      <td className="px-4 py-2">{o.offense_date ? new Date(o.offense_date).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2">{o.details || '-'}</td>
                      <td className="px-4 py-2">{o.sanction || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
