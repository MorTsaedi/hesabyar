import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty state placeholder used across pages.
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
      {icon && (
        <span className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-300 flex items-center justify-center mb-4">
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-slate-700 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
