import React, { useState, useEffect } from 'react';

interface Props {
  value: string; // Format: YYYY/MM/DD (Jalali)
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export function JalaliDateInput({ value, onChange, label, placeholder = '۱۴۰۴/۰۱/۰۱', error }: Props) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Only allow Persian/English digits and /
    val = val.replace(/[^۰-۹0-9/]/g, '');
    // Auto-format: YYYY/MM/DD
    const nums = val.replace(/\//g, '').replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
    let formatted = '';
    if (nums.length >= 4) {
      formatted = nums.slice(0, 4);
      if (nums.length >= 6) {
        formatted += '/' + nums.slice(4, 6);
        if (nums.length >= 8) {
          formatted += '/' + nums.slice(6, 8);
        } else {
          formatted += '/' + nums.slice(6);
        }
      } else {
        formatted += '/' + nums.slice(4);
      }
    } else {
      formatted = nums;
    }
    setDisplayValue(formatted);
    onChange(formatted);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ltr-force text-left
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'}
        `}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
