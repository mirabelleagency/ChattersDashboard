import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../lib/api';
import * as XLSX from 'xlsx';
import { useSharedDataContext } from '../contexts/SharedDataContext';
import { useSphThresholds } from '../hooks/useSphThresholds';
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

type DateRange = {
  start: Date;
  end: Date;
};

function deriveDataRange(rows: ChatterPerformance[]): DateRange | null {
  const dates: Date[] = [];
  rows.forEach(row => {
    const start = parseISODate(row.start_date);
    if (start) dates.push(start);
    const end = parseISODate(row.end_date);
    if (end) dates.push(end);
  });
  if (!dates.length) {
    return null;
  }
  const minDate = dates.reduce((min, current) => (current < min ? current : min));
  const maxDate = dates.reduce((max, current) => (current > max ? current : max));
  return {
    start: normalizeDate(minDate),
    end: normalizeDate(maxDate),
  };
}

function parseISODate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateInput(date: Date): string {
  // Return ISO yyyy-mm-dd for native date inputs
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value: string): Date {
  // Accept ISO yyyy-mm-dd from native date inputs
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatRangeLabel(range: DateRange): string {
  const { start, end } = range;
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  const monthSpan = startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth();
  const monthLength = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();

  if (monthSpan && startDate.getDate() === 1 && endDate.getDate() === monthLength) {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(startDate);
  }

  const startFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined,
  });
  const endFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startFormatter.format(startDate)} – ${endFormatter.format(endDate)}`;
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
    'chatter',
    'total_sales',
    'worked_hrs',
    'start_date',
    'end_date',
    'sph',
    'art',
    'gr',
    'ur',
    'ranking',
    'shift',
  ];
  const now = new Date();
  const startIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fallbackStart = formatAsMMDDYYYY(startIso);
  const fallbackEnd = formatAsMMDDYYYY(endIso);
  // Seed example rows (limit to a few)
  const sample = rows.slice(0, 8).map(r => ({
    'Chatter': r.chatter,
    'Total Sales': r.sales,
    'Start Date': r.start_date ? formatAsMMDDYYYY(r.start_date) : fallbackStart,
    'End Date': r.end_date ? formatAsMMDDYYYY(r.end_date) : fallbackEnd,
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
    ['Note: Dates must be mm/dd/yyyy only. Ranking is auto-calculated. Total Sales may be provided or will be computed as Worked Hrs * SPH. Column abbreviations: GR = Golden Ratio, UR = Unlock Rate.'],
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
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10 py-2">
          <button onClick={exportCurrentView} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2">
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
  const { performanceData, chatters, deleteChatter } = useSharedDataContext();
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  });
  const [initialRangeApplied, setInitialRangeApplied] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingRange, setPendingRange] = useState(() => ({
    start: formatDateInput(dateRange.start),
    end: formatDateInput(dateRange.end),
  }));
  const dateRangeLabel = useMemo(() => formatRangeLabel(dateRange), [dateRange]);
  const isRangeValid = useMemo(() => {
    if (!pendingRange.start || !pendingRange.end) return false;
    const start = parseDateInput(pendingRange.start);
    const end = parseDateInput(pendingRange.end);
    const startTime = start.getTime();
    const endTime = end.getTime();
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) return false;
    return startTime <= endTime;
  }, [pendingRange.end, pendingRange.start]);
  
  useEffect(() => {
    setPendingRange({
      start: formatDateInput(dateRange.start),
      end: formatDateInput(dateRange.end),
    });
  }, [dateRange]);

  // Keep default date range as current month; do not auto-expand to dataset range
  useEffect(() => {
    if (!initialRangeApplied) {
      setInitialRangeApplied(true);
    }
  }, [initialRangeApplied]);

  const handleToggleDatePicker = () => {
    setPendingRange({
      start: formatDateInput(dateRange.start),
      end: formatDateInput(dateRange.end),
    });
    setShowDatePicker(prev => !prev);
  };

  const handleApplyDateRange = () => {
    if (!isRangeValid) return;
    const start = parseDateInput(pendingRange.start);
    const end = parseDateInput(pendingRange.end);
    setDateRange({ start, end });
    setShowDatePicker(false);
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({ start, end });
    setShowDatePicker(false);
  };

  // Table filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'ranking' | 'sales' | 'sph' | 'ur'>('ranking');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'excellent' | 'review'>('all');
  const { thresholds, setThresholds, defaults: thresholdDefaults } = useSphThresholds();
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<any>('/auth/me');
        if (!cancelled) setIsAdmin(Boolean(me?.is_admin));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredPerformanceData = useMemo(() => {
    const rangeStart = normalizeDate(dateRange.start).getTime();
    const rangeEnd = normalizeDate(dateRange.end).getTime();
    return performanceData.filter(perf => {
      const start = parseISODate(perf.start_date) ?? parseISODate(perf.end_date);
      const end = parseISODate(perf.end_date) ?? start;
      if (!start && !end) return true;
      const startTime = start ? normalizeDate(start).getTime() : undefined;
      const endTime = end ? normalizeDate(end).getTime() : startTime;
      if (startTime === undefined || endTime === undefined) return true;
      return endTime >= rangeStart && startTime <= rangeEnd;
    });
  }, [performanceData, dateRange]);

  const shiftData: ShiftData[] = useMemo(() => {
    const map = new Map<string, { sales: number; chatters: number; hours: number }>();
    filteredPerformanceData.forEach(perf => {
      const key = perf.shift || 'Unassigned';
      const entry = map.get(key) ?? { sales: 0, chatters: 0, hours: 0 };
      entry.sales += perf.sales;
      entry.chatters += 1;
      entry.hours += perf.worked_hrs;
      map.set(key, entry);
    });
    return Array.from(map.entries()).map(([shift, value]) => ({
      shift,
      sales: value.sales,
      chatters: value.chatters,
      avg_sph: value.hours > 0 ? value.sales / value.hours : 0,
    }));
  }, [filteredPerformanceData]);

  const mostProfitableShift = useMemo(() => {
    if (!shiftData.length) return null;
    return shiftData.reduce<ShiftData | null>((best, entry) => {
      if (!best || entry.sales > best.sales) {
        return entry;
      }
      return best;
    }, null);
  }, [shiftData]);

  const totalChatters = filteredPerformanceData.length;
  const totalSales = filteredPerformanceData.reduce((sum, p) => sum + p.sales, 0);
  const totalHours = filteredPerformanceData.reduce((sum, p) => sum + p.worked_hrs, 0);
  const avgSPH = totalHours > 0 ? totalSales / totalHours : 0;
  const topPerformer = filteredPerformanceData.slice().sort((a, b) => b.sph - a.sph)[0];
  const topPerformerName = topPerformer?.chatter ?? '—';
  const topPerformerSPH = topPerformer ? topPerformer.sph.toFixed(2) : '0.00';
  const activeChatters = filteredPerformanceData.filter(perf => {
    const chatter = chatters.find(c => c.name === perf.chatter);
    return chatter?.is_active;
  }).length;
  const avgUnlockRate = filteredPerformanceData.length
    ? filteredPerformanceData.reduce((sum, p) => sum + p.ur, 0) / filteredPerformanceData.length
    : 0;
  const highPerformerCount = filteredPerformanceData.filter(p => p.sph >= thresholds.excellentMin).length;

  const topPerformersBySPH = filteredPerformanceData
    .slice()
    .sort((a, b) => b.sph - a.sph)
    .slice(0, 10);

  const topPerformersByUR = filteredPerformanceData
    .slice()
    .sort((a, b) => b.ur - a.ur)
    .slice(0, 10);

  // Filter and sort data for table
  let filteredData = selectedShift === 'all'
    ? filteredPerformanceData
    : filteredPerformanceData.filter(p => p.shift === selectedShift);

  // Apply search filter
  if (searchQuery) {
    filteredData = filteredData.filter(p => 
      p.chatter.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Apply status filter
  if (statusFilter === 'excellent') {
    filteredData = filteredData.filter(p => p.sph >= thresholds.excellentMin);
  } else if (statusFilter === 'review') {
    filteredData = filteredData.filter(p => p.sph < thresholds.reviewMax);
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
      {/* CEO Dashboard Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Team Performance Dashboard — {dateRangeLabel}</h2>
            <p className="text-blue-100 dark:text-blue-200">Real-time insights • Last updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleDatePicker}
                className="px-4 py-2 rounded-lg font-semibold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2h-2.5a1.5 1.5 0 01-3 0H9.5a1.5 1.5 0 01-3 0H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </button>
              {showDatePicker && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 space-y-4 z-20">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">Start Date</label>
                    <input
                      type="date"
                      value={pendingRange.start}
                      onChange={(e) => setPendingRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">End Date</label>
                    <input
                      type="date"
                      value={pendingRange.end}
                      onChange={(e) => setPendingRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResetToCurrentMonth}
                      className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                    >
                      Current Month
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!isRangeValid}
                        onClick={handleApplyDateRange}
                        className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-colors ${
                          isRangeValid
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
                        }`}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-5 py-2.5 rounded-lg font-semibold transition-all bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import Data
            </button>
            <ExportMenu performanceData={filteredPerformanceData} />
          </div>
        </div>
        
  {/* Quick Stats Row - Derived from filteredPerformanceData */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Total Revenue</div>
            <div className="text-2xl font-bold">${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm mt-1 text-blue-100">{totalChatters} chatters</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Avg SPH</div>
            <div className="text-2xl font-bold">${avgSPH.toFixed(2)}</div>
            <div className="text-sm mt-1 text-blue-100">Sales per hour</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Top Performer</div>
            <div className="text-2xl font-bold">{topPerformerName}</div>
            <div className="text-sm mt-1 text-blue-100">${topPerformerSPH} SPH</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Active Chatters</div>
            <div className="text-2xl font-bold">{activeChatters}</div>
            <div className="text-sm mt-1 text-blue-100">of {totalChatters} in range</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-blue-100 text-sm mb-1">Most Profitable Shift</div>
            <div className="text-2xl font-bold">{mostProfitableShift?.shift || '—'}</div>
            <div className="text-sm mt-1 text-blue-100">
              {mostProfitableShift
                ? `$${mostProfitableShift.sales.toLocaleString('en-US', { maximumFractionDigits: 0 })} • $${mostProfitableShift.avg_sph.toFixed(2)} SPH`
                : 'No data in range'}
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="🏆 Top 5 Performers">
          <div className="space-y-3">
            {topPerformersBySPH.slice(0, 5).map((perf, idx) => (
              <div key={perf.chatter} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full font-bold text-white text-sm flex items-center justify-center ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-blue-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{perf.chatter}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{perf.shift}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600 dark:text-blue-400">${perf.sph.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">${perf.sales.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="⚠️ Needs Attention">
          <div className="space-y-3">
            {filteredPerformanceData
              .filter(p => p.sph < thresholds.reviewMax)
              .sort((a, b) => a.sph - b.sph)
              .slice(0, 5)
              .map(perf => (
                <div key={perf.chatter} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{perf.chatter}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{perf.shift}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-orange-600 dark:text-orange-400">${perf.sph.toFixed(2)}</div>
                    <div className="text-xs text-orange-500 dark:text-orange-400">Below target</div>
                  </div>
                </div>
              ))}
            {filteredPerformanceData.filter(p => p.sph < thresholds.reviewMax).length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">🎉</div>
                <div>All chatters performing above threshold!</div>
              </div>
            )}
          </div>
        </Card>

        <Card title="📊 Quick Stats">
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Hours Worked</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalHours.toFixed(0)}h</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Performers</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {highPerformerCount}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">SPH ≥ ${thresholds.excellentMin}</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Unlock Rate</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {avgUnlockRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Shift Filter Buttons */}
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

      {/* Performance Rankings Table */}
  <Card title="🎯 Team Performance Rankings">
        {/* Filter Controls */}
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Status Filter + Threshold Editor */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                {isAdmin && (
                  <button
                    type="button"
                    title="Edit SPH thresholds"
                    onClick={() => setShowThresholdEditor(v => !v)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit thresholds
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'excellent' | 'review')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Chatters</option>
                <option value="excellent">🏆 Excellent (SPH ≥ ${thresholds.excellentMin})</option>
                <option value="review">⚠️ Needs Review (SPH &lt; ${thresholds.reviewMax})</option>
              </select>

              {isAdmin && showThresholdEditor && (
                <div className="mt-2 p-3 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Excellent min SPH</label>
                      <input
                        type="number"
                        min={0}
                        value={thresholds.excellentMin}
                        onChange={(e) => setThresholds({ excellentMin: Number(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Needs Review max SPH</label>
                      <input
                        type="number"
                        min={0}
                        value={thresholds.reviewMax}
                        onChange={(e) => setThresholds({ reviewMax: Number(e.target.value) })}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-gray-500">Defaults: ≥ {thresholdDefaults.excellentMin} for Excellent, &lt; {thresholdDefaults.reviewMax} for Review</div>
                    <button type="button" className="text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowThresholdEditor(false)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter Summary and Clear Button */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              Showing {filteredData.length} of {filteredPerformanceData.length} chatters
              {selectedShift !== 'all' && ` • Shift: ${selectedShift}`}
              {(searchQuery || statusFilter !== 'all') && (
                <span className="ml-2 text-blue-600 font-medium">
                  • {[searchQuery && 'Search', statusFilter !== 'all' && 'Status'].filter(Boolean).join(', ')} active
                </span>
              )}
            </div>
            {(searchQuery || statusFilter !== 'all' || selectedShift !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSelectedShift('all');
                }}
                className="self-start md:self-auto px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800"
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
                    Unlock Rate
                    {sortBy === 'ur' && (
                      <span className="text-blue-600 dark:text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Golden Ratio</th>
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
                        {perf.ranking === 1 && <span className="ml-2 align-middle text-lg" title="Gold">🥇</span>}
                        {perf.ranking === 2 && <span className="ml-2 align-middle text-lg" title="Silver">🥈</span>}
                        {perf.ranking === 3 && <span className="ml-2 align-middle text-lg" title="Bronze">🥉</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{perf.chatter}</div>
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
                            <>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-200"
                                onClick={() => navigate(`/chatters/${chatter.id}/view`)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900 dark:text-red-200"
                                onClick={async () => {
                                  if (confirm(`Permanently delete chatter "${chatter.name}" and ALL related data (shifts, performance, rankings, offenses)? This cannot be undone.`)) {
                                    await deleteChatter(chatter.id, { soft: false });
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </>
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
                  onClick={() => downloadExcelFile('chatters_import_template.xlsx', buildTemplateWorkbook(filteredPerformanceData))}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Download Import Template (Excel)
                </button>
              </div>
              {/* Upload Section */}
              <ImportUpload 
                onClose={() => setShowImportModal(false)}
                onImported={async () => {
                  // Refresh by reloading context or triggering refetch
                  setShowImportModal(false);
                  window.location.reload();
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
        // Cookie-based auth; include CSRF header
        headers: (() => {
          const headers: Record<string, string> = {}
          const m = document.cookie.match(/(?:^|; )csrf=([^;]*)/)
          if (m) headers['X-CSRF-Token'] = decodeURIComponent(m[1])
          return headers
        })(),
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
              <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Teams Created</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.teams_created ?? 0}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Chatters Created</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.chatters_created ?? 0}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Performance Records Added</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.performance_records ?? 0}</div>
                </div>
                {typeof result.stats.performance_updates === 'number' && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-200">
                    <div className="text-xs">Performance Records Updated</div>
                    <div className="text-lg font-semibold">{result.stats.performance_updates}</div>
                  </div>
                )}
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:bg-gray-800 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Shift Records Added</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.stats.shift_records ?? 0}</div>
                </div>
                {typeof result.stats.shift_updates === 'number' && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-center text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-200">
                    <div className="text-xs">Shift Records Updated</div>
                    <div className="text-lg font-semibold">{result.stats.shift_updates}</div>
                  </div>
                )}
                {typeof result.stats.rows_skipped === 'number' && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-200">
                    <div className="text-xs">Rows Skipped</div>
                    <div className="text-lg font-semibold">{result.stats.rows_skipped}</div>
                  </div>
                )}
              </div>
            )}

            {result.stats?.rows_skipped > 0 && Array.isArray(result.stats.skipped_samples) && result.stats.skipped_samples.length > 0 && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-100">
                <div className="font-semibold mb-1">Duplicates ignored</div>
                <p className="mb-2">The entries below were already in the system and were skipped during this import:</p>
                <ul className="space-y-1">
                  {result.stats.skipped_samples.slice(0, 10).map((dup: any, idx: number) => (
                    <li key={`${dup.chatter}-${dup.date}-${idx}`} className="flex items-start gap-2">
                      <span className="mt-0.5 text-xs">•</span>
                      <span>
                        <span className="font-medium">{dup.chatter}</span>
                        {dup.date && <span className="ml-1">({dup.date})</span>}
                        {dup.details && <span className="ml-1 text-xs text-yellow-800 dark:text-yellow-200/80">— {dup.details}</span>}
                      </span>
                    </li>
                  ))}
                  {result.stats.rows_skipped > result.stats.skipped_samples.length && (
                    <li className="text-xs italic text-yellow-800 dark:text-yellow-200/80">...and {result.stats.rows_skipped - result.stats.skipped_samples.length} more.</li>
                  )}
                </ul>
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
