import React from 'react';

export type StatTone = 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'slate';

interface StatCardProps {
  title: string;
  value: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  hint?: string;
  trend?: { value: string; positive: boolean };
  onClick?: () => void;
}

const toneStyles: Record<StatTone, { iconBg: string; iconText: string; bar: string }> = {
  brand: { iconBg: 'bg-brand-50', iconText: 'text-brand-700', bar: 'bg-brand-500' },
  green: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-700', bar: 'bg-emerald-500' },
  amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-700', bar: 'bg-amber-500' },
  red: { iconBg: 'bg-rose-50', iconText: 'text-rose-700', bar: 'bg-rose-500' },
  blue: { iconBg: 'bg-blue-50', iconText: 'text-blue-700', bar: 'bg-blue-500' },
  purple: { iconBg: 'bg-violet-50', iconText: 'text-violet-700', bar: 'bg-violet-500' },
  slate: { iconBg: 'bg-slate-100', iconText: 'text-slate-600', bar: 'bg-slate-400' },
};

/**
 * KPI / summary stat card used on dashboards.
 */
export function StatCard({ title, value, icon, tone = 'brand', hint, trend, onClick }: StatCardProps) {
  const t = toneStyles[tone];
  return (
    <div
      onClick={onClick}
      className={`card relative overflow-hidden p-4 ${onClick ? 'cursor-pointer hover:shadow-card-hover transition-shadow' : ''}`}
    >
      <span className={`absolute top-0 inset-x-0 h-0.5 ${t.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1.5 truncate">{title}</p>
          <p className="text-lg font-bold text-slate-900 ltr-force leading-tight truncate">{value}</p>
          {(hint || trend) && (
            <div className="flex items-center gap-2 mt-1.5">
              {trend && (
                <span
                  className={`text-[11px] font-bold ltr-force ${
                    trend.positive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {trend.positive ? '▲' : '▼'} {trend.value}
                </span>
              )}
              {hint && <span className="text-[11px] text-slate-400 truncate">{hint}</span>}
            </div>
          )}
        </div>
        {icon && (
          <span className={`w-9 h-9 rounded-xl ${t.iconBg} ${t.iconText} flex items-center justify-center shrink-0`}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
