import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Card } from '../components';

interface KPIData {
  sales_amount: number;
  sold_count: number;
  unlock_count: number;
  sph: number;
  avg_art: string;
  avg_ur: number;
  avg_gr: number;
}

interface ChatterPerformance {
  chatter: string;
  sales: number;
  worked_hrs: number;
  start_date?: string;
  end_date?: string;
  sph: number;
  art: string;
  gr: number;
  ur: number;
  ranking: number;
  shift: string;
}

interface ShiftData {
  shift: string;
  chatters: number;
  sales: number;
  avg_sph: number;
}

interface MetricComparison {
  chatter: string;
  sph: number;
  ur: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const SHIFT_COLORS: Record<string, string> = {
  'Shift A': '#3b82f6',
  'Shift B': '#10b981',
  'Shift C': '#f59e0b',
};

// CSV helpers
function buildTemplateCSV(rows: ChatterPerformance[]) {
  const headers = ['chatter', 'total_sales', 'worked_hrs', 'start_date', 'end_date', 'sph', 'art', 'gr', 'ur', 'ranking', 'shift'];
  const lines = [headers.join(',')];
  // include a few sample rows
  rows.slice(0, 8).forEach(r => {
    const cols = [
      `"${r.chatter}"`,
      r.sales.toString(),
      r.worked_hrs.toString(),
      r.start_date || '',
      r.end_date || '',
      r.sph.toString(),
      `"${r.art}"`,
      r.gr.toString(),
      r.ur.toString(),
      r.ranking.toString(),
      `"${r.shift}"`,
    ];
    lines.push(cols.join(','));
  });
  return lines.join('\n');
}

function downloadCSVFile(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Small export menu component
function ExportMenu({ performanceData }: { performanceData: ChatterPerformance[] }) {
  const [open, setOpen] = useState(false);

  function downloadTemplate() {
    const csv = buildTemplateCSV(performanceData);
    downloadCSVFile('chatters_import_template.csv', csv);
    setOpen(false);
  }

  function exportCurrentView() {
    // export current performanceData rows
    const headers = ['chatter', 'total_sales', 'worked_hrs', 'start_date', 'end_date', 'sph', 'art', 'gr', 'ur', 'ranking', 'shift'];
    const lines = [headers.join(',')];
    performanceData.forEach(r => {
      const cols = [
        `"${r.chatter}"`,
        r.sales.toString(),
        r.worked_hrs.toString(),
        r.start_date || '',
        r.end_date || '',
        r.sph.toString(),
        `"${r.art}"`,
        r.gr.toString(),
        r.ur.toString(),
        r.ranking.toString(),
        `"${r.shift}"`,
      ];
      lines.push(cols.join(','));
    });
    downloadCSVFile('chatters_export.csv', lines.join('\n'));
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-5 py-2.5 rounded-lg font-semibold transition-all bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l-3 3m0 0l-3-3m3 3V10" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-10 py-2">
          <button onClick={downloadTemplate} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 hover:text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Import Template (CSV)
          </button>
          <button onClick={exportCurrentView} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-gray-700 hover:text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Current View (CSV)
          </button>
        </div>
      )}
    </div>
  );
}

// Sample data from the provided table
const SAMPLE_DATA: ChatterPerformance[] = [
  { chatter: 'Lowie', sales: 14157.67, worked_hrs: 96, start_date: '2023-10-01', end_date: '2023-10-15', sph: 147.48, art: '51s', gr: 3.65, ur: 68.71, ranking: 1, shift: 'Shift A' },
  { chatter: 'Jerald', sales: 7388.00, worked_hrs: 75, start_date: '2023-10-01', end_date: '2023-10-15', sph: 98.51, art: '2m 5s', gr: 8.34, ur: 58.70, ranking: 2, shift: 'Shift C' },
  { chatter: 'RM', sales: 5760.00, worked_hrs: 72, start_date: '2023-10-01', end_date: '2023-10-15', sph: 80.00, art: '2m 8s', gr: 5.19, ur: 70.59, ranking: 3, shift: 'Shift B' },
  { chatter: 'Laurence', sales: 9258.39, worked_hrs: 120.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 76.83, art: '1m 59s', gr: 7.55, ur: 50.22, ranking: 4, shift: 'Shift C' },
  { chatter: 'Emman', sales: 4992.00, worked_hrs: 66, start_date: '2023-10-01', end_date: '2023-10-15', sph: 75.64, art: '1m 54s', gr: 5.96, ur: 59.29, ranking: 5, shift: 'Shift C' },
  { chatter: 'JC', sales: 7248.00, worked_hrs: 97.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 74.34, art: '2m 7s', gr: 5.02, ur: 41.67, ranking: 6, shift: 'Shift C' },
  { chatter: 'Marlon', sales: 4627.95, worked_hrs: 70, start_date: '2023-10-01', end_date: '2023-10-15', sph: 66.11, art: '1m 57s', gr: 2.22, ur: 56.25, ranking: 8, shift: 'Shift B' },
  { chatter: 'Jerome', sales: 3644.00, worked_hrs: 55.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 65.66, art: '1m 32s', gr: 3.24, ur: 65.38, ranking: 7, shift: 'Shift C' },
  { chatter: 'Jepp', sales: 6011.23, worked_hrs: 97, start_date: '2023-10-01', end_date: '2023-10-15', sph: 61.97, art: '1m 19s', gr: 4.24, ur: 53.45, ranking: 9, shift: 'Shift C' },
  { chatter: 'Baste', sales: 6492.00, worked_hrs: 112, start_date: '2023-10-01', end_date: '2023-10-15', sph: 57.96, art: '1m 38s', gr: 2.58, ur: 54.46, ranking: 10, shift: 'Shift B' },
  { chatter: 'Salman', sales: 4355.49, worked_hrs: 77, start_date: '2023-10-01', end_date: '2023-10-15', sph: 56.56, art: '1m 11s', gr: 2.23, ur: 60.00, ranking: 11, shift: 'Shift A' },
  { chatter: 'Tomm', sales: 2540.00, worked_hrs: 65, start_date: '2023-10-01', end_date: '2023-10-15', sph: 39.08, art: '1m 21s', gr: 2.95, ur: 49.12, ranking: 12, shift: 'Shift B' },
  { chatter: 'Rowie', sales: 2425.60, worked_hrs: 64, start_date: '2023-10-01', end_date: '2023-10-15', sph: 37.90, art: '1m 58s', gr: 4.96, ur: 61.11, ranking: 13, shift: 'Shift B' },
  { chatter: 'Bols', sales: 2608.00, worked_hrs: 74, start_date: '2023-10-01', end_date: '2023-10-15', sph: 35.24, art: '2m 2s', gr: 3.41, ur: 56.76, ranking: 14, shift: 'Shift A' },
  { chatter: 'Miko', sales: 2468.80, worked_hrs: 75.5, start_date: '2023-10-01', end_date: '2023-10-15', sph: 32.70, art: '2m 49s', gr: 4.85, ur: 55.56, ranking: 15, shift: 'Shift A' },
  { chatter: 'Rommel', sales: 2282.40, worked_hrs: 81, start_date: '2023-10-01', end_date: '2023-10-15', sph: 28.18, art: '1m 46s', gr: 4.00, ur: 63.33, ranking: 16, shift: 'Shift A' },
];


export default function Dashboard() {
  const [performanceData, setPerformanceData] = useState<ChatterPerformance[]>(SAMPLE_DATA);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');
  const [selectedShift, setSelectedShift] = useState<string>('all');

  // Calculate KPIs from sample data
  const kpis: KPIData = {
    sales_amount: performanceData.reduce((sum, p) => sum + p.sales, 0),
    sold_count: performanceData.length * 45, // Estimated
    unlock_count: performanceData.length * 30, // Estimated
    sph: performanceData.reduce((sum, p) => sum + p.sph, 0) / performanceData.length,
    avg_art: '1m 45s',
    avg_ur: performanceData.reduce((sum, p) => sum + p.ur, 0) / performanceData.length,
    avg_gr: performanceData.reduce((sum, p) => sum + p.gr, 0) / performanceData.length,
  };

  // Mock previous period data for trends (simulating -8% sales, +5% SPH, -2% UR)
  const trends = {
    sales: 8.3,
    sph: 12.4,
    ur: -3.2,
    gr: 5.7,
  };

  // Calculate shift distribution
  const shiftData: ShiftData[] = ['Shift A', 'Shift B', 'Shift C'].map(shift => {
    const shiftChatters = performanceData.filter(p => p.shift === shift);
    return {
      shift,
      chatters: shiftChatters.length,
      sales: shiftChatters.reduce((sum, p) => sum + p.sales, 0),
      avg_sph: shiftChatters.reduce((sum, p) => sum + p.sph, 0) / shiftChatters.length || 0,
    };
  });

  // Top performers by SPH
  const topPerformersBySPH = [...performanceData]
    .sort((a, b) => b.sph - a.sph)
    .slice(0, 10);

  // Top performers by UR
  const topPerformersByUR = [...performanceData]
    .sort((a, b) => b.ur - a.ur)
    .slice(0, 10);

  // Identify alerts and insights
  const alerts = {
    topPerformer: performanceData.reduce((max, p) => p.sph > max.sph ? p : max, performanceData[0]),
    underPerformers: performanceData.filter(p => p.sph < 40).sort((a, b) => a.sph - b.sph).slice(0, 3),
    highUR: performanceData.filter(p => p.ur > 65).length,
    lowUR: performanceData.filter(p => p.ur < 50).length,
  };

  // Filter by shift if needed
  const filteredData = selectedShift === 'all' 
    ? performanceData 
    : performanceData.filter(p => p.shift === selectedShift);

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Executive Summary</h2>
            <p className="text-blue-100">Period: Oct 1-15, 2023 • Last updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            {['7', '30', '90'].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days as '7' | '30' | '90')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === days ? 'bg-white text-blue-600' : 'bg-blue-700 text-white hover:bg-blue-600'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>
        
        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Total Revenue</div>
            <div className="text-2xl font-bold">${kpis.sales_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${trends.sales >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trends.sales >= 0 ? '↑' : '↓'} {Math.abs(trends.sales)}% vs last period
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Avg SPH</div>
            <div className="text-2xl font-bold">${kpis.sph.toFixed(2)}</div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${trends.sph >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trends.sph >= 0 ? '↑' : '↓'} {Math.abs(trends.sph)}% vs last period
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Unlock Rate</div>
            <div className="text-2xl font-bold">{kpis.avg_ur.toFixed(1)}%</div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${trends.ur >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trends.ur >= 0 ? '↑' : '↓'} {Math.abs(trends.ur)}% vs last period
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Active Chatters</div>
            <div className="text-2xl font-bold">{performanceData.length}</div>
            <div className="text-sm mt-1 text-blue-100">Across {shiftData.length} shifts</div>
          </div>
        </div>
      </div>

      {/* Critical Alerts & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="🎯 Key Insights">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl">⭐</div>
              <div className="flex-1">
                <div className="font-semibold text-green-900">Top Performer</div>
                <div className="text-sm text-green-700">
                  <strong>{alerts.topPerformer.chatter}</strong> leads with ${alerts.topPerformer.sph.toFixed(2)} SPH 
                  ({alerts.topPerformer.shift})
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl">📊</div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900">High Performers</div>
                <div className="text-sm text-blue-700">
                  {alerts.highUR} chatters with 65%+ unlock rate
                </div>
              </div>
            </div>

            {alerts.underPerformers.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-semibold text-orange-900">Attention Needed</div>
                  <div className="text-sm text-orange-700">
                    {alerts.underPerformers.length} chatters below $40 SPH threshold
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    {alerts.underPerformers.map(p => p.chatter).join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="📈 Performance Trends">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Revenue Growth</span>
                <span className={`text-lg font-bold ${trends.sales >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trends.sales >= 0 ? '+' : ''}{trends.sales}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${trends.sales >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(trends.sales) * 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">SPH Improvement</span>
                <span className={`text-lg font-bold ${trends.sph >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trends.sph >= 0 ? '+' : ''}{trends.sph}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${trends.sph >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(trends.sph) * 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Unlock Rate Change</span>
                <span className={`text-lg font-bold ${trends.ur >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trends.ur >= 0 ? '+' : ''}{trends.ur}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${trends.ur >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(trends.ur) * 10, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedShift('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedShift === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            All Shifts
          </button>
          {['Shift A', 'Shift B', 'Shift C'].map((shift) => (
            <button
              key={shift}
              onClick={() => setSelectedShift(shift)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedShift === shift ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'
              }`}
            >
              {shift}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-5 py-2.5 rounded-lg font-semibold transition-all bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import Data
          </button>
          <ExportMenu performanceData={performanceData} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="text-blue-100 text-sm font-medium">Total Sales</div>
            <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold mb-1">${kpis.sales_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className={`text-sm flex items-center gap-1 ${trends.sales >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {trends.sales >= 0 ? '↑' : '↓'} {Math.abs(trends.sales)}% from last period
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="text-green-100 text-sm font-medium">Avg SPH</div>
            <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-3xl font-bold mb-1">${kpis.sph.toFixed(2)}</div>
          <div className={`text-sm flex items-center gap-1 ${trends.sph >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {trends.sph >= 0 ? '↑' : '↓'} {Math.abs(trends.sph)}% improvement
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="text-purple-100 text-sm font-medium">Avg Unlock Rate</div>
            <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-3xl font-bold mb-1">{kpis.avg_ur.toFixed(1)}%</div>
          <div className={`text-sm flex items-center gap-1 ${trends.ur >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {trends.ur >= 0 ? '↑' : '↓'} {Math.abs(trends.ur)}% change
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="text-orange-100 text-sm font-medium">Avg ART</div>
            <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold mb-1">{kpis.avg_art}</div>
          <div className="text-orange-100 text-sm">Resolution time</div>
        </div>
      </div>

      {/* Charts Row 1: SPH and UR Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SPH Performance Chart */}
        <Card title="Sales Per Hour (SPH) - Top 10">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topPerformersBySPH} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="chatter" type="category" tick={{ fontSize: 12 }} width={70} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'SPH']}
              />
              <Bar dataKey="sph" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Unlock Rate Chart */}
        <Card title="Unlock Rate (UR) - Top 10">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topPerformersByUR} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="chatter" type="category" tick={{ fontSize: 12 }} width={70} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'UR']}
              />
              <Bar dataKey="ur" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2: Shift Distribution and Performance Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shift Distribution */}
        <Card title="Shift Distribution & Performance">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={shiftData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="shift" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Bar yAxisId="left" dataKey="chatters" fill="#10b981" name="Chatters" radius={[8, 8, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avg_sph" stroke="#3b82f6" strokeWidth={3} name="Avg SPH" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* SPH vs UR Scatter */}
        <Card title="SPH vs Unlock Rate Correlation">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="chatter" tick={{ fontSize: 10 }} height={80} interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Bar yAxisId="left" dataKey="sph" fill="#3b82f6" name="SPH ($)" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="right" dataKey="ur" fill="#8b5cf6" name="UR (%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Performance Rankings Table */}
      <Card title="📊 Team Performance Rankings">
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredData.length} of {performanceData.length} chatters
          {selectedShift !== 'all' && ` • Filtered by ${selectedShift}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chatter</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">SPH</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ART</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">UR</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">GR</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData
                .sort((a, b) => a.ranking - b.ranking)
                .map((perf) => {
                  const isTopPerformer = perf.sph >= 100;
                  const needsAttention = perf.sph < 40;
                  
                  return (
                    <tr key={perf.chatter} className={`hover:bg-gray-50 transition-colors ${
                      isTopPerformer ? 'bg-green-50' : needsAttention ? 'bg-orange-50' : ''
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-sm ${
                          perf.ranking === 1 ? 'bg-yellow-500' : 
                          perf.ranking === 2 ? 'bg-gray-400' : 
                          perf.ranking === 3 ? 'bg-orange-600' : 
                          'bg-blue-500'
                        }`}>
                          {perf.ranking}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900">{perf.chatter}</div>
                          {isTopPerformer && <span className="text-lg">⭐</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: `${SHIFT_COLORS[perf.shift]}20`,
                            color: SHIFT_COLORS[perf.shift]
                          }}
                        >
                          {perf.shift}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        ${perf.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {perf.worked_hrs}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-blue-600">
                        ${perf.sph.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {perf.art}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                        {perf.ur.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {perf.gr.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isTopPerformer && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Excellent
                          </span>
                        )}
                        {needsAttention && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Review
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl z-20">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium text-gray-900">Import Template & Instructions</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-600">You can download a CSV template pre-filled with sample rows. Required fields: chatter, total_sales (Total Sales), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), worked_hrs, sph, art, gr, ur, ranking, shift.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSVFile('chatters_import_template.csv', buildTemplateCSV(performanceData))}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Download Template (CSV)
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded"
                >
                  Done
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-500">After filling the template, use your import flow to upload and preview the data.</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {shiftData.reduce((sum, s) => sum + s.chatters, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Active Chatters</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {performanceData.reduce((sum, p) => sum + p.worked_hrs, 0).toFixed(0)}h
            </div>
            <div className="text-sm text-gray-500">Total Hours Worked</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              ${(kpis.sales_amount / performanceData.reduce((sum, p) => sum + p.worked_hrs, 0)).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Overall SPH</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
