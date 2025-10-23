import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, Button, Badge, Table } from '../components'

interface Chatter { id:number; name:string; handle?:string; email?:string; phone?:string; team_name?:string; is_active:boolean }

export default function Chatters(){
  const [rows, setRows] = useState<Chatter[]>([])
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  async function load(){
    setLoading(true)
    try {
      const data = await api<Chatter[]>('/chatters')
      setRows(data)
    } catch (error) {
      console.error('Failed to load chatters:', error)
    } finally {
      setLoading(false)
    }
  }

  async function create(){
    if (!name.trim()) return
    try {
      const item = await api<Chatter>('/admin/chatters', { 
        method:'POST', 
        body: JSON.stringify({ name: name.trim(), team_name: team.trim() || undefined }) 
      })
      setRows([item, ...rows])
      setName('')
      setTeam('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to create chatter:', error)
    }
  }

  async function remove(id:number){
    if (!confirm('Are you sure you want to delete this chatter?')) return
    try {
      await api(`/admin/chatters/${id}`, { method:'DELETE' })
      setRows(rows.filter(r=>r.id!==id))
    } catch (error) {
      console.error('Failed to delete chatter:', error)
    }
  }

  useEffect(()=>{ load() },[])

  const filteredRows = rows.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.team_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (value: string, row: Chatter) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {row.handle && <div className="text-sm text-gray-500">@{row.handle}</div>}
        </div>
      )
    },
    {
      key: 'team_name',
      label: 'Team',
      render: (value: string) => value ? (
        <Badge variant="info">{value}</Badge>
      ) : (
        <span className="text-gray-400">No Team</span>
      )
    },
    {
      key: 'email',
      label: 'Contact',
      render: (_: any, row: Chatter) => (
        <div className="text-sm">
          {row.email && <div className="text-gray-700">{row.email}</div>}
          {row.phone && <div className="text-gray-500">{row.phone}</div>}
          {!row.email && !row.phone && <span className="text-gray-400">—</span>}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value: boolean) => (
        <Badge variant={value ? 'success' : 'default'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_: any, row: Chatter) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => remove(row.id)}
        >
          Delete
        </Button>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500">Manage your team members and chatters</p>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Chatter'}
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Add New Chatter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter chatter name"
                  value={name}
                  onChange={e=>setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && create()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter team name"
                  value={team}
                  onChange={e=>setTeam(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && create()}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={create} disabled={!name.trim()}>
                Create Chatter
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <Card>
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Search chatters by name or team..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Total Chatters</div>
          <div className="text-2xl font-bold text-gray-900">{rows.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{rows.filter(r => r.is_active).length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Teams</div>
          <div className="text-2xl font-bold text-blue-600">
            {new Set(rows.map(r => r.team_name).filter(Boolean)).size}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={filteredRows}
          keyField="id"
          emptyMessage={searchTerm ? 'No chatters found matching your search' : 'No chatters yet. Add your first chatter above!'}
        />
      )}
    </div>
  )
}
