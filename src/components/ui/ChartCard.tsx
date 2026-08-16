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
import { Bar, Line, Doughnut } from 'react-chartjs-2';

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
ChartJS.defaults.color = '#64748b';
ChartJS.defaults.scale.grid.color = '#f1f5f9';

interface ChartCardProps {
  title: string;
  type: 'bar' | 'line' | 'doughnut';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }[];
  className?: string;
}

export function ChartCard({ title, type, labels, datasets, className = '' }: ChartCardProps) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        rtl: true,
        textDirection: 'rtl',
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y?: number; x?: number } }) => {
            const val = context.parsed.y ?? context.parsed.x ?? 0;
            return `${context.dataset.label ?? ''}: ${val.toLocaleString('fa-IR')}`;
          },
        },
      },
    },
    scales: type !== 'doughnut' ? {
      x: {
        ticks: {
          font: { size: 11 },
        },
      },
      y: {
        ticks: {
          font: { size: 11 },
          callback: (value: number) => value.toLocaleString('fa-IR'),
        },
      },
    } : undefined,
  };

  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      ...ds,
      borderRadius: type === 'bar' ? 4 : undefined,
      tension: type === 'line' ? 0.4 : undefined,
    })),
  };

  const ChartComponent = type === 'bar' ? Bar : type === 'line' ? Line : Doughnut;

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
      <div className="h-64">
        <ChartComponent data={data} options={options as any} />
      </div>
    </div>
  );
}
