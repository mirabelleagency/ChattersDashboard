import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';
import * as XLSX from 'xlsx';
import { useSharedDataContext } from '../contexts/SharedDataContext';
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

// Excel template (10 columns) helpers
function buildTemplateWorkbook(rows: ChatterPerformance[]) {
  // Required headers per spec (updated: add Total Sales after Chatter, remove Ranking)
  const headers = [
    'Chatter',
    'Total Sales',
    'Start Date',
    'End Date',
    'Worked Hrs',
    'SPH',
    'ART',
    'GR',
    'UR',
    'Shift',
  ];
  // Seed example rows (limit to a few)
  const sample = rows.slice(0, 8).map(r => ({
    'Chatter': r.chatter,
    'Total Sales': r.sales,
    'Start Date': r.start_date ? formatAsMMDDYYYY(r.start_date) : '10/01/2023',
    'End Date': r.end_date ? formatAsMMDDYYYY(r.end_date) : '10/15/2023',
    'Worked Hrs': r.worked_hrs,
    'SPH': r.sph,
    'ART': r.art,
    'GR': r.gr,
    'UR': r.ur,
    'Shift': r.shift,
  }));

  const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
  // Prepend an instruction row
  const info = [
    ['Note: Dates must be mm/dd/yyyy only. Ranking is auto-calculated. Total Sales may be provided or will be computed as Worked Hrs * SPH.'],
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(info);
  // Merge info and data by creating a new sheet range
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, infoSheet, 'Info');
  XLSX.utils.book_append_sheet(wb, ws, 'Import');
  return wb;
}

function downloadExcelFile(filename: string, wb: XLSX.WorkBook) {
  XLSX.writeFile(wb, filename);
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
    const wb = buildTemplateWorkbook(performanceData);
    downloadExcelFile('chatters_import_template.xlsx', wb);
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
            Download Import Template (Excel)
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

// Utility to format an ISO-like date string into mm/dd/yyyy for the template
function formatAsMMDDYYYY(d: string) {
  // Accepts 'YYYY-MM-DD' or similar; returns 'MM/DD/YYYY'
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  try {
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yyyy = String(dt.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return d;
  }
}


export default function Dashboard() {
  const { performanceData, chatters, deleteChatter, setPerformanceData, loadChatters } = useSharedDataContext();
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [refreshNonce, setRefreshNonce] = useState(0);
  
  // Table filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'ranking' | 'sales' | 'sph' | 'ur'>('ranking');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [minSPH, setMinSPH] = useState<number | ''>('');
  const [maxSPH, setMaxSPH] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'excellent' | 'review'>('all');

  // Backend-driven KPIs and trends
  const [kpis, setKpis] = useState<KPIData>({ sales_amount: 0, sold_count: 0, unlock_count: 0, sph: 0, avg_art: '', avg_ur: 0, avg_gr: 0 });
  const [trends, setTrends] = useState<{ sales: number; sph: number; ur: number; gr: number }>({ sales: 0, sph: 0, ur: 0, gr: 0 });
  const [topPerformer, setTopPerformer] = useState<{ chatter_name: string; value: number } | null>(null);
  const [topHighUR, setTopHighUR] = useState<Array<{ chatter_name: string; value: number }>>([]);
  const [underPerformers, setUnderPerformers] = useState<Array<{ chatter: string; sph: number }>>([]);

  function ymd(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function computeRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return { start: ymd(start), end: ymd(end) };
  }

  useEffect(() => {
    let cancelled = false;
    async function loadFromBackend() {
      try {
        const days = period === '7' ? 7 : period === '30' ? 30 : 90;
        const { start, end } = computeRange(days);
        const prevStartDate = new Date(start);
        const prevEndDate = new Date(end);
        prevStartDate.setDate(prevStartDate.getDate() - days);
        prevEndDate.setDate(prevEndDate.getDate() - days);
        const prev = { start: ymd(prevStartDate), end: ymd(prevEndDate) };

        // Fetch KPIs for current and previous period
        type KPIApi = { sales_amount: number; sold_count: number; unlock_count: number; avg_sph: number };
        const [curKpis, prevKpis]: [KPIApi, KPIApi] = await Promise.all([
          api<KPIApi>(`/performance/kpis?start=${start}&end=${end}`),
          api<KPIApi>(`/performance/kpis?start=${prev.start}&end=${prev.end}`),
        ]);
        if (cancelled) return;
        setKpis({
          sales_amount: curKpis.sales_amount,
          sold_count: curKpis.sold_count,
          unlock_count: curKpis.unlock_count,
          sph: curKpis.avg_sph,
          avg_art: '',
          avg_ur: 0,
          avg_gr: 0,
        });
        const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);
        setTrends({
          sales: pct(curKpis.sales_amount, prevKpis.sales_amount),
          sph: pct(curKpis.avg_sph, prevKpis.avg_sph),
          ur: pct(curKpis.unlock_count, prevKpis.unlock_count),
          gr: 0,
        });

        // Rankings
        const [rankSph, rankConv] = await Promise.all([
          api<any[]>(`/performance/rankings?metric=sph&start=${start}&end=${end}&limit=1`),
          api<any[]>(`/performance/rankings?metric=conversion_rate&start=${start}&end=${end}&limit=3`),
        ]);
        if (cancelled) return;
        setTopPerformer(rankSph && rankSph.length ? { chatter_name: rankSph[0].chatter_name, value: rankSph[0].value } : null);
        setTopHighUR((rankConv || []).map(r => ({ chatter_name: r.chatter_name, value: r.value })));

        // Underperformers by SPH < 40 via reports API (grouped by chatter)
        const report = await api<{ rows: Array<{ chatter: string | null; values: { sph: number } }> }>(`/reports/run`, {
          method: 'POST',
          body: JSON.stringify({ metrics: ['sph'], dimensions: ['chatter'], start, end }),
        });
        if (cancelled) return;
        const lows = (report.rows || [])
          .filter(r => r.chatter && (r.values?.sph ?? 0) < 40)
          .sort((a, b) => (a.values.sph ?? 0) - (b.values.sph ?? 0))
          .slice(0, 3)
          .map(r => ({ chatter: r.chatter as string, sph: r.values.sph || 0 }));
        setUnderPerformers(lows);
      } catch (e) {
        // swallow errors; UI will show zeros/empty safely
      }
    }
    loadFromBackend();
    return () => { cancelled = true };
  }, [period, refreshNonce]);

  // Shift distribution not available from backend; hide dependent text/metrics for now.
  const shiftData: ShiftData[] = [];

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
    topPerformer,
    underPerformers,
    highUR: topHighUR.length,
    lowUR: 0,
  };

  // Filter and sort data for table
  let filteredData = selectedShift === 'all' 
    ? performanceData 
    : performanceData.filter(p => p.shift === selectedShift);

  // Apply search filter
  if (searchQuery) {
    filteredData = filteredData.filter(p => 
      p.chatter.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply SPH range filter
  if (minSPH !== '') {
    filteredData = filteredData.filter(p => p.sph >= minSPH);
  }
  if (maxSPH !== '') {
    filteredData = filteredData.filter(p => p.sph <= maxSPH);
  }

  // Apply status filter
  if (statusFilter === 'excellent') {
    filteredData = filteredData.filter(p => p.sph >= 100);
  } else if (statusFilter === 'review') {
    filteredData = filteredData.filter(p => p.sph < 40);
  }

  // Apply sorting
  const sortedData = [...filteredData].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'sales':
        comparison = a.sales - b.sales;
        break;
      case 'sph':
        comparison = a.sph - b.sph;
        break;
      case 'ur':
        comparison = a.ur - b.ur;
        break;
      case 'ranking':
      default:
        comparison = a.ranking - b.ranking;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  function toggleSort(column: 'ranking' | 'sales' | 'sph' | 'ur') {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  }

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
        <Card title="💡 Key Insights">
          <div className="space-y-3">
            {alerts.topPerformer && (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-2xl">🏆</div>
                <div className="flex-1">
                  <div className="font-semibold text-green-900 dark:text-green-100">Top Performer</div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <strong>{alerts.topPerformer.chatter_name}</strong> leads with ${alerts.topPerformer.value.toFixed(2)} SPH
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl">🎯</div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 dark:text-blue-100">High Performers</div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {alerts.highUR} chatters with 65%+ unlock rate
                </div>
                {topHighUR.length > 0 && (
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {topHighUR.map(p => p.chatter_name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {alerts.underPerformers.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-semibold text-orange-900 dark:text-orange-100">Attention Needed</div>
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    {alerts.underPerformers.length} chatters below $40 SPH threshold
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    {alerts.underPerformers.map(p => p.chatter).join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="📊 Performance Trends">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Revenue Growth</span>
                <span className={`text-lg font-bold ${trends.sales >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trends.sales >= 0 ? '+' : ''}{trends.sales}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${trends.sales >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(trends.sales) * 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SPH Improvement</span>
                <span className={`text-lg font-bold ${trends.sph >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trends.sph >= 0 ? '+' : ''}{trends.sph}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${trends.sph >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(Math.abs(trends.sph) * 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Unlock Rate Change</span>
                <span className={`text-lg font-bold ${trends.ur >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trends.ur >= 0 ? '+' : ''}{trends.ur}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
              selectedShift === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
            }`}
          >
            All Shifts
          </button>
          {['Shift A', 'Shift B', 'Shift C'].map((shift) => (
            <button
              key={shift}
              onClick={() => setSelectedShift(shift)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedShift === shift ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
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
  <Card title="🎯 Team Performance Rankings">
        {/* Table Summary Metrics */}
        {(() => {
          const totalChatters = filteredData.length;
          const totalHours = filteredData.reduce((sum, p) => sum + p.worked_hrs, 0);
          const totalSales = filteredData.reduce((sum, p) => sum + p.sales, 0);
          const overallSPH = totalHours > 0 ? totalSales / totalHours : 0;
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Active Chatters</div>
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{totalChatters}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Hours Worked</div>
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{totalHours.toFixed(0)}h</div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Overall SPH</div>
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">${overallSPH.toFixed(2)}</div>
              </div>
            </div>
          );
        })()}

        {/* Filter Controls */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Box */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search Chatter</label>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Min SPH */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Min SPH ($)</label>
              <input
                type="number"
                placeholder="0"
                min={0}
                value={minSPH}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') return setMinSPH('');
                  const n = Math.max(0, Number(v));
                  setMinSPH(Number.isFinite(n) ? n : 0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Max SPH */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max SPH ($)</label>
              <select
                value={maxSPH === '' ? '' : String(maxSPH)}
                onChange={(e) => setMaxSPH(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Any</option>
                <option value="30">&lt;30</option>
                <option value="40">&lt;40</option>
                <option value="50">&lt;50</option>
                <option value="60">&lt;60</option>
                <option value="70">&lt;70</option>
                <option value="80">&lt;80</option>
                <option value="90">&lt;90</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'excellent' | 'review')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Chatters</option>
                <option value="excellent">🏆 Excellent (SPH &gt;= $100)</option>
                <option value="review">⚠️ Needs Review (SPH &lt; $40)</option>
              </select>
            </div>
          </div>

          {/* Filter Summary and Clear Button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredData.length} of {performanceData.length} chatters
              {selectedShift !== 'all' && ` • Filtered by ${selectedShift}`}
              {(searchQuery || minSPH || maxSPH || statusFilter !== 'all') && (
                <span className="ml-2 text-blue-600 font-medium">
                  • {[
                    searchQuery && 'Search',
                    minSPH && 'Min SPH',
                    maxSPH && 'Max SPH',
                    statusFilter !== 'all' && 'Status'
                  ].filter(Boolean).join(', ')} active
                </span>
              )}
            </div>
            {(searchQuery || minSPH || maxSPH || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setMinSPH('');
                  setMaxSPH('');
                  setStatusFilter('all');
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th 
                  onClick={() => toggleSort('ranking')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Rank
                    {sortBy === 'ranking' && (
                      <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chatter</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift</th>
                <th 
                  onClick={() => toggleSort('sales')}
                  className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Sales
                    {sortBy === 'sales' && (
                      <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hours</th>
                <th 
                  onClick={() => toggleSort('sph')}
                  className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    SPH
                    {sortBy === 'sph' && (
                      <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ART</th>
                <th 
                  onClick={() => toggleSort('ur')}
                  className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    UR
                    {sortBy === 'ur' && (
                      <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">GR</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredData
                .sort((a, b) => a.ranking - b.ranking)
                .map((perf) => {
                  const isTopPerformer = perf.sph >= 100;
                  const needsAttention = perf.sph < 40;
                  // Find chatter by name for actions/status
                  const chatter = chatters.find(c => c.name === perf.chatter);
                  
                  return (
                    <tr key={perf.chatter} className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      isTopPerformer ? 'bg-green-50 dark:bg-green-900/20' : needsAttention ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-sm ${
                          perf.ranking === 1 ? 'bg-yellow-500' : 
                          perf.ranking === 2 ? 'bg-gray-400' : 
                          perf.ranking === 3 ? 'bg-orange-600' : 
                          'bg-blue-500'
                        }`}>
                          {perf.ranking}
                        </div>
                        {perf.ranking === 2 && <span className="ml-2 align-middle text-lg" title="Silver">🥈</span>}
                        {perf.ranking === 3 && <span className="ml-2 align-middle text-lg" title="Bronze">🥉</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{perf.chatter}</div>
                          {isTopPerformer && <span className="text-lg">🏆</span>}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                        ${perf.sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {perf.worked_hrs}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-blue-600 dark:text-blue-400">
                        ${perf.sph.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {perf.art}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {perf.ur.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                        {perf.gr.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isTopPerformer && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                            Excellent
                          </span>
                        )}
                        {needsAttention && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200">
                            Review
                          </span>
                        )}
                        {chatter && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${chatter.is_active ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            {chatter.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {chatter && (
                            <button
                              className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700"
                              onClick={async () => {
                                if (confirm(`Permanently delete chatter "${chatter.name}" and ALL related data (shifts, performance, rankings, offenses)? This cannot be undone.`)) {
                                  await deleteChatter(chatter.id, { soft: false });
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
              <p className="text-sm text-gray-600">Download the Excel template with these columns: Chatter, Start Date, End Date, Worked Hrs, SPH, ART, GR, UR, Ranking, Shift. Dates must be in mm/dd/yyyy format only.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadExcelFile('chatters_import_template.xlsx', buildTemplateWorkbook(performanceData))}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Download Import Template (Excel)
                </button>
              </div>
              {/* Upload Section */}
              <ImportUpload 
                onClose={() => setShowImportModal(false)}
                onImported={async () => {
                  // Refresh chatters list and backend-driven KPIs/rankings without page reload
                  try { await loadChatters(); } catch {}
                  setRefreshNonce(n => n + 1);
                }}
              />
              <div className="mt-2 text-sm text-gray-500">After uploading, data will be processed server-side and a summary will be shown.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Import Upload Component
function ImportUpload({ onClose, onImported }: { onClose: () => void; onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  async function handleUpload() {
    setError('');
    setResult(null);
    if (!file) {
      setError('Please select an Excel or CSV file (.xlsx, .xls, or .csv)');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/admin/import/excel', {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Import failed');
      }
  const data = await res.json();
  setResult(data);
  // Notify parent to refresh live data (chatters, KPIs, rankings)
  try { onImported && onImported(); } catch {}
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t pt-4">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (.xlsx, .xls, .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-200 bg-red-50 text-red-800 text-sm">
            <span>❌</span>
            <div>
              <div className="font-medium">Import failed</div>
              <div className="text-xs opacity-90">{error}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Uploading…' : 'Upload & Import'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded">Done</button>
        </div>
        {result && (
          <div className="mt-3">
            {/* Success banner */}
            <div className={`flex items-start gap-3 p-3 rounded-md border ${
              result.status === 'success' ? 'border-green-200 bg-green-50 text-green-900' : 'border-yellow-200 bg-yellow-50 text-yellow-900'
            }`}>
              <div className="text-xl">{result.status === 'success' ? '✅' : '⚠️'}</div>
              <div className="flex-1">
                <div className="font-semibold">Import {result.status === 'success' ? 'completed' : 'completed with warnings'}</div>
                <div className="text-sm opacity-90">
                  <span className="mr-2">📄</span>
                  <span className="font-medium">{result.filename || 'Uploaded file'}</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            {result.stats && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Teams Created</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.teams_created ?? 0}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Chatters Created</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.chatters_created ?? 0}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Performance Records</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.performance_records ?? 0}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Shift Records</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.shift_records ?? 0}</div>
                </div>
              </div>
            )}

            {/* Optional details toggle */}
            <div className="mt-3 flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                onClick={() => setShowDetails(v => !v)}
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setShowDetails(false);
                }}
              >
                Import another file
              </button>
              <button
                className="ml-auto px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            {showDetails && (
              <pre className="mt-2 bg-gray-50 p-3 rounded border text-xs overflow-auto text-gray-800 dark:text-gray-200 dark:bg-gray-900 dark:border-gray-700">{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
