import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface KPIData {
  sales_amount: number;
  sold_count: number;
  unlock_count: number;
  sph: number;
}

interface TrendData {
  date: string;
  sales: number;
  sold: number;
  unlocks: number;
}

interface TopPerformer {
  chatter: string;
  sales: number;
  sph: number;
  sold: number;
}

interface TeamData {
  team: string;
  sales: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [teamBreakdown, setTeamBreakdown] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // Load KPIs for the selected period
      const kpiResponse = await api<any>('/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: ['sales_amount', 'sold_count', 'unlock_count', 'sph'],
          dimensions: [],
          preset: period === '7' ? 'last_7_days' : period === '30' ? 'last_30_days' : 'last_3_months',
        }),
      });

      if (kpiResponse.rows && kpiResponse.rows.length > 0) {
        const row = kpiResponse.rows[0];
        setKpis({
          sales_amount: row.values.sales_amount || 0,
          sold_count: row.values.sold_count || 0,
          unlock_count: row.values.unlock_count || 0,
          sph: row.values.sph || 0,
        });
      }

      // Load trend data (daily breakdown)
      const trendResponse = await api<any>('/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: ['sales_amount', 'sold_count', 'unlock_count'],
          dimensions: ['date'],
          preset: period === '7' ? 'last_7_days' : period === '30' ? 'last_30_days' : 'last_3_months',
        }),
      });

      if (trendResponse.rows && trendResponse.rows.length > 0) {
        const trendData = trendResponse.rows
          .map((row: any) => ({
            date: row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
            sales: row.values.sales_amount || 0,
            sold: row.values.sold_count || 0,
            unlocks: row.values.unlock_count || 0,
          }))
          .sort((a: any, b: any) => a.date.localeCompare(b.date));
        setTrends(trendData);
      }

      // Load top performers
      const topResponse = await api<any>('/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: ['sales_amount', 'sold_count', 'sph'],
          dimensions: ['chatter'],
          preset: period === '7' ? 'last_7_days' : period === '30' ? 'last_30_days' : 'last_3_months',
        }),
      });

      if (topResponse.rows && topResponse.rows.length > 0) {
        const performers = topResponse.rows
          .map((row: any) => ({
            chatter: row.chatter || 'Unknown',
            sales: row.values.sales_amount || 0,
            sph: row.values.sph || 0,
            sold: row.values.sold_count || 0,
          }))
          .sort((a: any, b: any) => b.sales - a.sales)
          .slice(0, 5);
        setTopPerformers(performers);
      }

      // Load team breakdown
      const teamResponse = await api<any>('/reports/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: ['sales_amount'],
          dimensions: ['team'],
          preset: period === '7' ? 'last_7_days' : period === '30' ? 'last_30_days' : 'last_3_months',
        }),
      });

      if (teamResponse.rows && teamResponse.rows.length > 0) {
        const teams = teamResponse.rows.map((row: any) => ({
          team: row.team || 'No Team',
          sales: row.values.sales_amount || 0,
        }));
        setTeamBreakdown(teams);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500">Performance overview and key metrics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('7')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '7' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setPeriod('30')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '30' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod('90')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '90' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-blue-100 text-sm font-medium">Total Sales</div>
              <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">${kpis.sales_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-blue-100 text-xs mt-2">Last {period} days</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-green-100 text-sm font-medium">Sold Count</div>
              <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{kpis.sold_count.toLocaleString()}</div>
            <div className="text-green-100 text-xs mt-2">Successful conversions</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-purple-100 text-sm font-medium">Unlocks</div>
              <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-3xl font-bold">{kpis.unlock_count.toLocaleString()}</div>
            <div className="text-purple-100 text-xs mt-2">Content unlocks</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-orange-100 text-sm font-medium">Avg SPH</div>
              <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-3xl font-bold">${kpis.sph.toFixed(2)}</div>
            <div className="text-orange-100 text-xs mt-2">Sales per hour</div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Sales ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Team Performance Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={teamBreakdown as any}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.team}: ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="sales"
              >
                {teamBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Metrics Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Metrics</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="sold" fill="#10b981" name="Sold" radius={[8, 8, 0, 0]} />
            <Bar dataKey="unlocks" fill="#8b5cf6" name="Unlocks" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
        <div className="space-y-4">
          {topPerformers.map((performer, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{performer.chatter}</div>
                  <div className="text-sm text-gray-500">{performer.sold} sales · ${performer.sph.toFixed(2)} SPH</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">${performer.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-500">Total Revenue</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
