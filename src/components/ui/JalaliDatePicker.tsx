import { useState, useEffect, useRef } from 'react';
import { toPersianNumber } from '../../lib/persian-number';
import {
  getJalaliDaysInMonth,
  getJalaliMonthName,
  JALALI_WEEKDAYS,
  todayJalali,
  createJalaliDate,
} from '../../lib/jalali';
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react';

interface Props {
  value: string; // YYYY/MM/DD
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function JalaliDatePicker({ value, onChange, label, placeholder = '۱۴۰۴/۰۱/۰۱', error, disabled, required, className = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [viewYear, setViewYear] = useState(1404);
  const [viewMonth, setViewMonth] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = todayJalali();
  const selectedParts = value ? parseJalali(value) : null;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Set view to selected date or today
  useEffect(() => {
    if (selectedParts) {
      setViewYear(selectedParts.year);
      setViewMonth(selectedParts.month);
    } else {
      const parts = parseJalali(today);
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    val = val.replace(/[^۰-۹0-9/]/g, '');
    const nums = val.replace(/\//g, '').replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728));
    let formatted = '';
    if (nums.length >= 4) {
      formatted = nums.slice(0, 4);
      if (nums.length >= 6) {
        formatted += '/' + nums.slice(4, 6);
        if (nums.length >= 8) formatted += '/' + nums.slice(6, 8);
        else formatted += '/' + nums.slice(6);
      } else formatted += '/' + nums.slice(4);
    } else formatted = nums;
    setInputValue(formatted);
    onChange(formatted);
  };

  const selectDate = (day: number) => {
    const str = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    onChange(str);
    setInputValue(str);
    setIsOpen(false);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
    else { setViewMonth(viewMonth - 1); }
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
    else { setViewMonth(viewMonth + 1); }
  };

  const goToToday = () => {
    const parts = parseJalali(today);
    setViewYear(parts.year);
    setViewMonth(parts.month);
    selectDate(parts.day);
  };

  const daysInMonth = getJalaliDaysInMonth(viewYear, viewMonth);
  const firstDayDate = createJalaliDate(viewYear, viewMonth, 1);
  const firstDow = firstDayDate.getDay(); // 0=Sun..6=Sat → shift so Sat=0
  const startOffset = firstDow === 6 ? 0 : firstDow + 1;

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Today highlighting
  const todayParts = parseJalali(today);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}{required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          maxLength={10}
          disabled={disabled}
          className={`w-full border rounded-lg py-2 pl-10 pr-3 text-sm outline-none ltr-force text-left transition-colors
            ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'}
            ${disabled ? 'bg-slate-50 text-slate-400' : 'bg-white'}
          `}
        />
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-72 ltr-force" dir="ltr">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={goToPrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600" type="button">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold text-slate-800">
              {getJalaliMonthName(viewMonth)} {toPersianNumber(viewYear)}
            </div>
            <button onClick={goToNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600" type="button">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {JALALI_WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-slate-500 py-1">{d.slice(0, 1)}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              if (d === null) return <div key={i} />;
              const isToday = d === todayParts.day && viewMonth === todayParts.month && viewYear === todayParts.year;
              const isSelected = d === selectedParts?.day && viewMonth === selectedParts?.month && viewYear === selectedParts?.year;
              return (
                <button
                  key={i}
                  onClick={() => selectDate(d)}
                  type="button"
                  className={`text-center py-1.5 text-sm rounded-lg transition-colors
                    ${isSelected ? 'bg-primary-600 text-white font-medium' : ''}
                    ${isToday && !isSelected ? 'bg-primary-50 text-primary-700 font-medium' : ''}
                    ${!isSelected && !isToday ? 'text-slate-700 hover:bg-slate-100' : ''}
                  `}
                >
                  {toPersianNumber(d)}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <button onClick={goToToday} type="button" className="text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1">
              امروز
            </button>
            <button onClick={() => setIsOpen(false)} type="button" className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseJalali(str: string): { year: number; month: number; day: number } {
  const parts = str.split('/');
  return {
    year: parseInt(parts[0]) || 1400,
    month: parseInt(parts[1]) || 1,
    day: parseInt(parts[2]) || 1,
  };
}
