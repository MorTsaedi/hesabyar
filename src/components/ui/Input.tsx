import React from 'react';
import { fromPersianNumber, toPersianNumber } from '../../lib/persian-number';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
  persianNumbers?: boolean;
}

export function Input({
  error = false,
  helperText,
  className = '',
  persianNumbers = false,
  value,
  ...props
}: InputProps) {
  const baseClasses = 'w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  // Hide native browser arrow controls for numeric inputs
  const inputClasses = 'appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield] [-moz-appearance:textfield]';

  const stateClasses = error
    ? 'border-rose-300 bg-rose-50'
    : 'border-slate-200 bg-white hover:border-slate-300';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!props.onChange) return;
    if (persianNumbers) {
      // Accept Persian digits in input, convert to English before calling onChange
      const raw = e.target.value;
      const englishValue = raw ? fromPersianNumber(raw) : '';
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: englishValue,
        },
      };
      props.onChange(syntheticEvent as any);
    } else {
      props.onChange(e);
    }
  };

  // When persianNumbers is enabled, render the displayed value as Persian digits
  const displayValue =
    persianNumbers && value !== undefined && value !== null && value !== ''
      ? toPersianNumber(String(value))
      : value;

  return (
    <div className="flex flex-col gap-1">
      <input
        className={`${baseClasses} ${stateClasses} ${inputClasses} ${className} rtl:text-right`}
        dir="auto"
        {...props}
        value={displayValue}
        onChange={handleChange}
      />
      {helperText && (
        <p className={`text-xs ${error ? 'text-rose-600' : 'text-slate-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
}
