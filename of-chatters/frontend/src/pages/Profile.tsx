import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Card } from '../components';
import { useSharedDataContext } from '../contexts/SharedDataContext';
import type { Chatter } from '../hooks/useSharedData';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const chatterId = Number(id);
  const { performanceData } = useSharedDataContext();

  const [chatter, setChatter] = useState<Chatter | null>(null);
  const [offenses, setOffenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchChatterDetails();
  }, [chatterId]);

  async function fetchChatterDetails() {
    try {
      setLoading(true);
      const chatterData = await api<Chatter>(`/admin/chatters/${chatterId}`);
      setChatter(chatterData);
      
      // Fetch offenses
      try {
        const offensesData = await api<any[]>(`/offenses?chatter_id=${chatterId}`);
        setOffenses(offensesData);
      } catch {}
      
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load chatter details');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !chatter) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Chatter Profile</h2>
          <button onClick={() => navigate('/chatters')} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            Back to list
          </button>
        </div>
        <Card>
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{error || 'Chatter not found'}</div>
        </Card>
      </div>
    );
  }

  // Get performance data for this chatter
  const performance = performanceData.find(p => p.chatter === chatter.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{chatter.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Chatter Profile & Performance Overview</p>
        </div>
        <button 
          onClick={() => navigate('/chatters')} 
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Back to list
        </button>
      </div>

      {/* Basic Information */}
      <Card title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {chatter.external_id && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Unique ID</label>
              <p className="text-gray-900 dark:text-gray-100">{chatter.external_id}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <p className="text-gray-900 dark:text-gray-100">{chatter.name}</p>
          </div>
          {chatter.handle && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Handle</label>
              <p className="text-gray-900 dark:text-gray-100">{chatter.handle}</p>
            </div>
          )}
          {chatter.email && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
              <p className="text-gray-900 dark:text-gray-100">{chatter.email}</p>
            </div>
          )}
          {chatter.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</label>
              <p className="text-gray-900 dark:text-gray-100">{chatter.phone}</p>
            </div>
          )}
          {chatter.team_name && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Team</label>
              <p className="text-gray-900 dark:text-gray-100">{chatter.team_name}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              chatter.is_active 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
            }`}>
              {chatter.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      {performance && (
        <Card title="Performance Metrics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Ranking</label>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">#{performance.ranking}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-green-600 dark:text-green-400 mb-1">SPH (Sales Per Hour)</label>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">${performance.sph.toFixed(2)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Unlock Rate</label>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{performance.ur.toFixed(1)}%</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Total Sales</label>
              <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">${performance.sales.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">Hours Worked</label>
              <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{performance.worked_hrs}h</p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
              <label className="block text-sm font-medium text-pink-600 dark:text-pink-400 mb-1">Shift</label>
              <p className="text-3xl font-bold text-pink-900 dark:text-pink-100">{performance.shift}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Response Time</label>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{performance.art}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Goal Rate</label>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{performance.gr.toFixed(2)}%</p>
            </div>
          </div>
        </Card>
      )}

      {/* Misconduct History */}
      <Card title="Misconduct History">
        {offenses.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No misconduct records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Offense</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Sanction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {offenses.map((offense) => (
                  <tr key={offense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{offense.offense_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{offense.offense || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {offense.offense_date ? new Date(offense.offense_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{offense.details || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{offense.sanction || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/chatters/${chatterId}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Edit Chatter
        </button>
      </div>
    </div>
  );
}
