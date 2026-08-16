import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: boolean;
}

/**
 * Unified card surface for the new design system.
 */
export function Card({
  title,
  description,
  icon,
  action,
  children,
  className = '',
  bodyClassName = '',
  padding = true,
}: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
              )}
              {description && (
                <p className="text-xs text-slate-400 truncate">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={padding ? `p-5 ${bodyClassName}` : bodyClassName}>{children}</div>
    </div>
  );
}
