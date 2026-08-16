/**
 * Jalali (Persian) Date Utilities
 * Using date-fns-jalali for reliable conversions
 */

import {
  format as fnsFormat,
  parse as fnsParse,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
} from 'date-fns-jalali';

// Type for Jalali date parts
export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Convert a Date object to Jalali date string (YYYY/MM/DD)
 */
export function toJalaliString(date: Date): string {
  return fnsFormat(date, 'yyyy/MM/dd');
}

/**
 * Convert a Jalali date string (YYYY/MM/DD) to Date object
 * Returns null if invalid
 */
export function fromJalaliString(dateStr: string): Date | null {
  try {
    const parsed = fnsParse(dateStr, 'yyyy/MM/dd', new Date());
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Format a Date to a Persian display format (۱۴۰۳/۰۵/۱۵)
 */
export function formatJalali(date: Date, formatStr: string = 'yyyy/MM/dd'): string {
  return fnsFormat(date, formatStr);
}

/**
 * Get today's date as Jalali string
 */
export function todayJalali(): string {
  return toJalaliString(new Date());
}

/**
 * Get Jalali year, month, day parts from a Date
 */
export function getJalaliParts(date: Date): JalaliDateParts {
  return {
    year: parseInt(fnsFormat(date, 'yyyy')),
    month: parseInt(fnsFormat(date, 'MM')),
    day: parseInt(fnsFormat(date, 'dd')),
  };
}

/**
 * Get number of days in a specific Jalali month
 */
export function getJalaliDaysInMonth(year: number, month: number): number {
  const date = fnsParse(`${year}/${month.toString().padStart(2, '0')}/01`, 'yyyy/MM/dd', new Date());
  return getDaysInMonth(date);
}

/**
 * Jalali month names in Persian
 */
export const JALALI_MONTHS: string[] = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند',
];

/**
 * Get Persian name of a Jalali month
 */
export function getJalaliMonthName(month: number): string {
  return JALALI_MONTHS[month - 1] || '';
}

/**
 * Jalali weekday names in Persian
 */
export const JALALI_WEEKDAYS: string[] = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه',
  'چهارشنبه', 'پنج‌شنبه', 'جمعه',
];

/**
 * Create a Jalali date from year, month, day
 */
export function createJalaliDate(year: number, month: number, day: number): Date {
  const str = `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
  const date = fromJalaliString(str);
  return date || new Date();
}

/**
 * Get first day of Jalali month
 */
export function startOfJalaliMonth(date: Date): Date {
  return startOfMonth(date);
}

/**
 * Get last day of Jalali month
 */
export function endOfJalaliMonth(date: Date): Date {
  return endOfMonth(date);
}

/**
 * Add days to a date
 */
export function addJalaliDays(date: Date, days: number): Date {
  return addDays(date, days);
}

/**
 * Subtract days from a date
 */
export function subJalaliDays(date: Date, days: number): Date {
  return subDays(date, days);
}

/**
 * Get current Jalali year
 */
export function currentJalaliYear(): number {
  return parseInt(fnsFormat(new Date(), 'yyyy'));
}

/**
 * Get current Jalali month
 */
export function currentJalaliMonth(): number {
  return parseInt(fnsFormat(new Date(), 'MM'));
}
