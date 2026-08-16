import React from 'react';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'brand' | 'purple';

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const toneStyles: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
};

const dotStyles: Record<BadgeTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-blue-500',
  slate: 'bg-slate-400',
  brand: 'bg-brand-500',
  purple: 'bg-violet-500',
};

/**
 * Status badge with tone + optional dot indicator.
 */
export function Badge({ tone = 'slate', children, className = '', dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${toneStyles[tone]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[tone]}`} />}
      {children}
    </span>
  );
}
