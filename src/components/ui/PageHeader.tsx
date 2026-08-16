import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: string;
}

/**
 * Consistent page header for every page in the app.
 */
export function PageHeader({ title, description, icon, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {breadcrumb && (
            <p className="text-[11px] text-slate-400 font-medium mb-0.5">{breadcrumb}</p>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-slate-500 mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}
