import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { Card, Button } from '../components'

type MetricValue =
  | 'sales_amount'
  | 'sold_count'
  | 'unlock_count'
  | 'retention_count'
  | 'sph'
  | 'golden_ratio'
  | 'conversion_rate'

type DimensionValue = 'date' | 'team' | 'chatter'

type MetricFormat = 'currency' | 'number' | 'percent'

interface MetricOption {
  value: MetricValue
  label: string
  icon: string
  format: MetricFormat
}

interface DimensionOption {
  value: DimensionValue
  label: string
  icon: string
}

interface PresetOption {
  value: string
  label: string
  days: number
}

interface ReportRow {
  values?: Partial<Record<MetricValue, number | string>>
  [key: string]: unknown
}

interface SavedReport {
  id: number
  name: string
  created_at: string
  config_json?: {
    metrics?: MetricValue[]
    dimensions?: DimensionValue[]
    start?: string
    end?: string
    preset?: string
  }
}

const METRICS: MetricOption[] = [
  { value: 'sales_amount', label: 'Sales Amount', icon: '$', format: 'currency' },
  { value: 'sold_count', label: 'Sold Count', icon: '#', format: 'number' },
  { value: 'unlock_count', label: 'Unlocks', icon: 'U', format: 'number' },
  { value: 'retention_count', label: 'Retention', icon: 'R', format: 'number' },
  { value: 'sph', label: 'Sales Per Hour (SPH)', icon: 'H', format: 'number' },
  { value: 'golden_ratio', label: 'Golden Ratio', icon: 'G', format: 'percent' },
  { value: 'conversion_rate', label: 'Conversion Rate', icon: '%', format: 'percent' },
]

const DIMENSIONS: DimensionOption[] = [
  { value: 'date', label: 'Date', icon: 'D' },
  { value: 'team', label: 'Team', icon: 'T' },
  { value: 'chatter', label: 'Chatter', icon: 'C' },
]

const PRESETS: PresetOption[] = [
  { value: 'last_7_days', label: 'Last 7 Days', days: 7 },
  { value: 'last_30_days', label: 'Last 30 Days', days: 30 },
  { value: 'last_3_months', label: 'Last 3 Months', days: 90 },
  { value: 'last_6_months', label: 'Last 6 Months', days: 180 },
  { value: 'last_1_year', label: 'Last Year', days: 365 },
]

export default function Reports() {
  const [metrics, setMetrics] = useState<MetricValue[]>(['sales_amount', 'sph'])
  const [dimensions, setDimensions] = useState<DimensionValue[]>(['date', 'team'])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [preset, setPreset] = useState('')
  const [rows, setRows] = useState<ReportRow[]>([])
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadSaved()
  }, [])

  useEffect(() => {
    if (preset) {
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  function toggleMetric(value: MetricValue) {
    setMetrics((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  function toggleDimension(value: DimensionValue) {
    setDimensions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function computePresetRange(presetValue: string) {
    const presetOption = PRESETS.find((option) => option.value === presetValue)
    if (!presetOption) {
      return { start, end }
    }

    const today = new Date()
    const presetEnd = formatDate(today)

    const presetStartDate = new Date(today)
    presetStartDate.setDate(presetStartDate.getDate() - (presetOption.days - 1))
    const presetStart = formatDate(presetStartDate)

    return { start: presetStart, end: presetEnd }
  }

  const effectiveRange = useMemo(() => {
    if (preset) {
      return computePresetRange(preset)
    }
    return { start, end }
  }, [preset, start, end])

  async function run() {
    setLoading(true)
    try {
      const payload = {
        metrics,
        dimensions,
        start: start || undefined,
        end: end || undefined,
        preset: preset || undefined,
      }
      const response = await api<{ rows?: ReportRow[] }>('/reports/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setRows(response.rows ?? [])
    } catch (error) {
      console.error('Failed to run report:', error)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (saving) {
      return
    }

    setSaving(true)
    try {
      const name = saveName.trim() || `Report ${new Date().toLocaleString()}`
      await api('/reports/save', {
        method: 'POST',
        body: JSON.stringify({
          name,
          config_json: { metrics, dimensions, start, end, preset },
          is_public: false,
        }),
      })
      setSaveName('')
      setShowSaveDialog(false)
      await loadSaved()
    } catch (error) {
      console.error('Failed to save report:', error)
    } finally {
      setSaving(false)
    }
  }

  async function loadSaved() {
    try {
      const response = await api<SavedReport[]>('/reports/saved')
      setSaved(response)
    } catch (error) {
      console.error('Failed to load saved reports:', error)
    }
  }

  function formatMetricValue(value: number | string | undefined, metric: MetricOption) {
    if (value == null || value === '') {
      return '--'
    }

    if (typeof value === 'string' && metric.format !== 'currency') {
      return value
    }

    if (typeof value === 'number') {
      if (metric.format === 'currency') {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      if (metric.format === 'percent') {
        return `${(value * 100).toFixed(1)}%`
      }
      return value.toLocaleString()
    }

    return value
  }

  function handlePresetClick(value: string) {
    setPreset(value)
    setStart('')
    setEnd('')
  }

  function handleLoadSavedReport(report: SavedReport) {
    const config = report.config_json
    if (!config) {
      return
    }

    setMetrics(config.metrics?.length ? config.metrics : ['sales_amount', 'sph'])
    setDimensions(config.dimensions?.length ? config.dimensions : ['date', 'team'])
    setStart(config.start ?? '')
    setEnd(config.end ?? '')
    setPreset(config.preset ?? '')
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-500">Build custom reports by mixing metrics, dimensions, and date ranges</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Metrics">
          <div className="space-y-2">
            {METRICS.map((metric) => (
              <label
                key={metric.value}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={metrics.includes(metric.value)}
                  onChange={() => toggleMetric(metric.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-lg" aria-hidden>{metric.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-700">{metric.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Dimensions">
          <div className="space-y-2">
            {DIMENSIONS.map((dimension) => (
              <label
                key={dimension.value}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={dimensions.includes(dimension.value)}
                  onChange={() => toggleDimension(dimension.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-lg" aria-hidden>{dimension.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-700">{dimension.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Date Range">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick select</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((presetOption) => (
                  <button
                    key={presetOption.value}
                    onClick={() => handlePresetClick(presetOption.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      preset === presetOption.value
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {presetOption.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom range</label>
              <div className="space-y-3">
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={start}
                  onChange={(event) => {
                    setStart(event.target.value)
                    setPreset('')
                  }}
                />
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={end}
                  onChange={(event) => {
                    setEnd(event.target.value)
                    setPreset('')
                  }}
                />
              </div>
            </div>

            {(effectiveRange.start || effectiveRange.end) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900">Selected range</div>
                <div className="text-sm text-blue-700 mt-1">
                  {`${effectiveRange.start || '--'} -> ${effectiveRange.end || '--'}`}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void run()} disabled={loading || metrics.length === 0 || dimensions.length === 0}>
          {loading ? 'Running...' : 'Run report'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowSaveDialog(true)}
          disabled={rows.length === 0}
        >
          Save report
        </Button>
        {(start || end || preset) && (
          <Button
            variant="ghost"
            onClick={() => {
              setStart('')
              setEnd('')
              setPreset('')
            }}
          >
            Clear range
          </Button>
        )}
      </div>

      {showSaveDialog && (
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Save current configuration</h3>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Report name (optional)"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void save()
                }
              }}
            />
            <div className="flex gap-3">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving' : 'Save report'}
              </Button>
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Results">
        {loading ? (
          <div className="py-10 text-center text-gray-500">Running report...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-500">Run a report to see results</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">{rows.length} rows returned</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {dimensions.map((dimension) => (
                      <th
                        key={dimension}
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {DIMENSIONS.find((item) => item.value === dimension)?.label ?? dimension}
                      </th>
                    ))}
                    {metrics.map((metric) => (
                      <th
                        key={metric}
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {METRICS.find((item) => item.value === metric)?.label ?? metric}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {dimensions.map((dimension) => (
                        <td key={dimension} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(row[dimension] as string) ?? ''}
                        </td>
                      ))}
                      {metrics.map((metric) => {
                        const metricOption = METRICS.find((item) => item.value === metric)!
                        const value = row.values?.[metric]
                        return (
                          <td key={metric} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatMetricValue(value as number | string | undefined, metricOption)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card title="Saved reports">
        {saved.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">Saved reports will appear here</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((report) => (
              <button
                key={report.id}
                onClick={() => handleLoadSavedReport(report)}
                className="p-4 border border-gray-200 rounded-lg text-left hover:border-blue-300 hover:shadow transition-all"
              >
                <div className="font-medium text-gray-900">{report.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Saved {new Date(report.created_at).toLocaleDateString()}
                </div>
                {report.config_json?.metrics && (
                  <div className="mt-3 text-xs text-gray-500">
                    Metrics: {report.config_json.metrics.join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
