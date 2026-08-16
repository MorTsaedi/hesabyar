import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import { Download, Settings, X, Paintbrush } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useUIStore } from '../../stores/useUIStore';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Persian-friendly defaults
ChartJS.defaults.font.family = "'Vazirmatn', 'IRANSans', 'Tahoma', system-ui, sans-serif";

interface EnhancedChartProps {
  title: string;
  /**
   * Stable identifier used to persist user preferences (chart type,
   * custom colours) across restarts. Defaults to the title.
   */
  chartId?: string;
  type: 'bar' | 'line' | 'area' | 'doughnut' | 'pie' | 'stacked-bar';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    borderDash?: number[];
  }[];
  className?: string;
  allowColorChange?: boolean;
}

/**
 * Persisted preferences for a single chart.
 * `colors` may be either:
 *   - a map of dataset-index → single hex (replaces whole dataset colour), or
 *   - a map of dataset-index → map of data-point-index → hex (per slice / bar).
 * `chartType` overrides the default chart type when set.
 */
interface ChartPrefs {
  colors?: Record<number, string | Record<number, string>>;
  chartType?: EnhancedChartProps['type'];
}

const STORAGE_PREFIX = 'hesabyar.chart.';

function loadPrefs(chartId: string): ChartPrefs | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + chartId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as ChartPrefs;
    return null;
  } catch {
    return null;
  }
}

function savePrefs(chartId: string, prefs: ChartPrefs) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + chartId, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (e.g. private mode)
  }
}

const chartTypeOptions: { value: string; label: string }[] = [
  { value: 'bar', label: 'میلهای' },
  { value: 'line', label: 'خطی' },
  { value: 'area', label: 'ناحیهای' },
  { value: 'doughnut', label: 'حلقوی' },
  { value: 'pie', label: 'دایرهای' },
  { value: 'stacked-bar', label: 'میلهای انباشته' },
];

const colorPresets = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#1e293b',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#0ea5e9',
  '#6366f1', '#d946ef', '#f43f5e', '#7c3aed', '#0891b2',
];

/** True for chart types that don't use axes */
function isCircular(type: string): boolean {
  return type === 'doughnut' || type === 'pie';
}

/** Resolve the effective displayed background colours for a dataset. */
function resolveBackgroundColors(
  original: string | string[] | undefined,
  datasetCustom: string | Record<number, string> | undefined,
  numDataPoints: number
): string | string[] | undefined {
  if (!original) return original;
  if (Array.isArray(original)) {
    // Per-data-point colours (e.g. doughnut / pie slices).
    const arr = [...original];
    if (datasetCustom && typeof datasetCustom === 'object' && !Array.isArray(datasetCustom)) {
      for (let i = 0; i < Math.min(arr.length, numDataPoints); i++) {
        if (datasetCustom[i]) arr[i] = datasetCustom[i]!;
      }
    }
    return arr;
  }
  // Single-string colour for the whole dataset.
  if (datasetCustom && typeof datasetCustom === 'string') {
    return datasetCustom;
  }
  return original;
}

export function EnhancedChart({ title, chartId, type: defaultType, labels, datasets, className = '', allowColorChange = true }: EnhancedChartProps) {
  const effectiveChartId = chartId || title;
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<EnhancedChartProps['type']>(defaultType);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorDatasetIndex, setColorDatasetIndex] = useState(0);
  const [colorDataIndex, setColorDataIndex] = useState(0);
  const [customColors, setCustomColors] = useState<Record<number, string | Record<number, string>>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  // Reset preferred data-point index whenever the user switches dataset.
  useEffect(() => {
    setColorDataIndex(0);
  }, [colorDatasetIndex]);

  // Load persisted preferences on mount.
  useEffect(() => {
    const prefs = loadPrefs(effectiveChartId);
    if (prefs) {
      if (prefs.chartType) setChartType(prefs.chartType);
      if (prefs.colors) setCustomColors(prefs.colors);
    }
    // We only want to honour the persisted state on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveChartId]);

  // Persist on change (debounced via microtask).
  useEffect(() => {
    const prefs: ChartPrefs = {};
    let dirty = false;
    if (Object.keys(customColors).length > 0) {
      prefs.colors = customColors;
      dirty = true;
    }
    if (chartType !== defaultType) {
      prefs.chartType = chartType;
      dirty = true;
    }
    if (!dirty) {
      // Clear any stale entry for this chart so deleted charts don't accumulate.
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + effectiveChartId);
      } catch {
        // ignore
      }
      return;
    }
    savePrefs(effectiveChartId, prefs);
  }, [customColors, chartType, defaultType, effectiveChartId]);

  const handleExport = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0d1526' : '#ffffff',
        logging: false,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.click();
    } catch (err) {
      console.error('Chart export failed:', err);
    }
  };

  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  // Build options based on the active chartType, not the prop
  const options = useMemo(() => {
    const base: Record<string, unknown> = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
        },
      },
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12 },
            color: isDark ? '#cbd5e1' : '#475569',
          },
        },
        tooltip: {
          rtl: true,
          textDirection: 'rtl',
          padding: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, family: 'Vazirmatn' },
          bodyFont: { size: 13, family: 'Vazirmatn' },
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y?: number; x?: number } }) => {
              const val = context.parsed.y ?? context.parsed.x ?? 0;
              return `${context.dataset.label ?? ''}: ${val.toLocaleString('fa-IR')}`;
            },
          },
        },
      },
    };

    if (!isCircular(chartType)) {
      const tickColor = isDark ? '#8fa0b8' : '#64748b';
      const gridColor = isDark ? '#263450' : '#e2e8f0';
      base.scales = {
        x: {
          ticks: { font: { size: 11, family: 'Vazirmatn' }, color: tickColor },
          grid: { display: false },
          stacked: chartType === 'stacked-bar',
        },
        y: {
          ticks: {
            font: { size: 11, family: 'Vazirmatn' },
            color: tickColor,
            callback: (value: number) => value.toLocaleString('fa-IR'),
          },
          grid: { color: gridColor },
          stacked: chartType === 'stacked-bar',
        },
      };
    } else {
      base.cutout = '65%';
    }

    return base;
  }, [chartType, isDark]);

  // Data (stable, only recomputed when labels/datasets/colors change)
  const data = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, dsIndex) => {
      const datasetCustom = customColors[dsIndex];
      const numPoints = labels.length || ds.data.length;
      const bgColor = resolveBackgroundColors(ds.backgroundColor, datasetCustom, numPoints);
      const borderColor = Array.isArray(ds.borderColor)
        ? resolveBackgroundColors(ds.borderColor, datasetCustom, numPoints)
        : (typeof ds.borderColor === 'string'
            ? (typeof datasetCustom === 'string' ? datasetCustom : ds.borderColor)
            : ds.borderColor);
      return {
        ...ds,
        backgroundColor: bgColor,
        borderColor,
        borderRadius: chartType === 'bar' || chartType === 'stacked-bar' ? 6 : undefined,
        tension: chartType === 'line' || chartType === 'area' ? 0.4 : undefined,
        fill: chartType === 'area' ? true : ds.fill,
        borderWidth: isCircular(chartType) ? 0 : (ds.borderWidth ?? 2),
      };
    }),
  }), [labels, datasets, chartType, customColors]);

  const renderChart = () => {
    const sharedProps = { data, options: options as any };
    switch (chartType) {
      case 'bar':
        return <Bar {...sharedProps} />;
      case 'line':
        return <Line {...sharedProps} />;
      case 'area':
        return <Line {...sharedProps} />;
      case 'doughnut':
        return <Doughnut {...sharedProps} />;
      case 'pie':
        return <Pie {...sharedProps} />;
      case 'stacked-bar':
        return <Bar {...sharedProps} />;
      default:
        return <Bar {...sharedProps} />;
    }
  };

  const activeDataset = datasets[colorDatasetIndex];
  const hasArrayColors = Array.isArray(activeDataset?.backgroundColor);

  const selectColorPreset = (color: string) => {
    setCustomColors((prev) => {
      const dsCustom = prev[colorDatasetIndex];
      if (hasArrayColors) {
        // Map of data-point-index → colour
        const next: Record<number, string> =
          dsCustom && typeof dsCustom === 'object' && !Array.isArray(dsCustom)
            ? { ...dsCustom }
            : {};
        next[colorDataIndex] = color;
        return { ...prev, [colorDatasetIndex]: next };
      }
      // Single-colour dataset → store as a plain string per dataset index.
      return { ...prev, [colorDatasetIndex]: color };
    });
  };

  const resetColors = () => {
    setCustomColors((prev) => {
      const next = { ...prev };
      delete next[colorDatasetIndex];
      return next;
    });
  };

  const resetAll = () => {
    setCustomColors({});
    setChartType(defaultType);
  };

  const getCurrentColor = (): string => {
    const dsCustom = customColors[colorDatasetIndex];
    if (hasArrayColors) {
      if (dsCustom && typeof dsCustom === 'object' && !Array.isArray(dsCustom)) {
        const c = dsCustom[colorDataIndex];
        if (c) return c;
      }
      if (Array.isArray(activeDataset?.backgroundColor)) {
        return activeDataset.backgroundColor[colorDataIndex] || '#64748b';
      }
      return '#64748b';
    }
    if (typeof dsCustom === 'string') return dsCustom;
    if (typeof activeDataset?.backgroundColor === 'string') {
      return activeDataset.backgroundColor;
    }
    return '#64748b';
  };

  return (
    <>
      {/* Main Chart */}
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="تمام صفحه"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="ذخیره تصویر"
            >
              <Download className="w-4 h-4" />
            </button>
            {allowColorChange && datasets.length > 0 && (
              <button
                onClick={() => setShowColorPicker(true)}
                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                title="تغییر رنگ نمودار"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowTypePicker(true)}
              className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="تغییر نوع نمودار"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div ref={chartRef} className="chart-container" style={{ height: '280px', minHeight: '280px' }}>
          {renderChart()}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] relative flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <button onClick={() => setIsFullscreen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-5">
              <div className="chart-container" style={{ minHeight: '400px' }}>
                {renderChart()}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={handleExport}
                className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ذخیره تصویر
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">انتخاب رنگ نمودار</h3>
              <button onClick={() => setShowColorPicker(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">انتخاب مجموعه داده برای تغییر رنگ:</p>
              <div className="flex flex-wrap gap-2">
                {datasets.map((ds, idx) => {
                  const dsCustom = customColors[idx];
                  const arrColors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : null;
                  const preview = arrColors
                    ? (dsCustom && typeof dsCustom === 'object' && !Array.isArray(dsCustom)
                        ? Object.values(dsCustom)[0] ?? arrColors[0]
                        : arrColors[0])
                    : (typeof dsCustom === 'string'
                        ? dsCustom
                        : (ds.backgroundColor as string) || '#64748b');
                  return (
                    <button
                      key={idx}
                      onClick={() => setColorDatasetIndex(idx)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm
                        ${colorDatasetIndex === idx ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:bg-slate-50'}`}
                    >
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preview }} />
                      <span className="font-medium">{ds.label || `مجموعه ${idx + 1}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {hasArrayColors && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">انتخاب داده برای تغییر رنگ:</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {labels.map((label, idx) => {
                    const dsCustom = customColors[colorDatasetIndex];
                    const cur =
                      dsCustom && typeof dsCustom === 'object' && !Array.isArray(dsCustom) && dsCustom[idx]
                        ? dsCustom[idx]
                        : (Array.isArray(activeDataset?.backgroundColor)
                            ? activeDataset.backgroundColor[idx]
                            : '#64748b');
                    return (
                      <button
                        key={idx}
                        onClick={() => setColorDataIndex(idx)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all
                          ${colorDataIndex === idx ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:bg-slate-50'}`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cur }} />
                        <span className="font-medium">{label || `نقطه ${idx + 1}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">
                {hasArrayColors ? 'انتخاب رنگ جدید برای این نقطه:' : 'انتخاب رنگ جدید:'}
              </p>
              <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
                {colorPresets.map((color) => {
                  const isSelected = getCurrentColor().toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      onClick={() => selectColorPreset(color)}
                      className={`w-8 h-8 rounded-lg transition-all ${isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={resetColors}
                className="text-sm text-slate-600 hover:text-primary-600 transition-colors"
              >
                بازنشانی این مجموعه
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetAll}
                  className="text-sm text-rose-600 hover:text-rose-700 transition-colors"
                  title="حذف تمام تنظیمات ذخیره شده"
                >
                  بازنشانی همه
                </button>
                <button
                  onClick={() => setShowColorPicker(false)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  اعمال و بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Type Picker Modal */}
      {showTypePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-sm p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">انتخاب نوع نمودار</h3>
              <button onClick={() => setShowTypePicker(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {chartTypeOptions.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => {
                    setChartType(ct.value as any);
                    setShowTypePicker(false);
                  }}
                  className={`w-full text-right px-4 py-3 rounded-lg transition-colors hover:bg-slate-100 flex items-center justify-between
                    ${chartType === ct.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600'}`}
                >
                  <span>{ct.label}</span>
                  {chartType === ct.value && <span className="text-primary-600">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
