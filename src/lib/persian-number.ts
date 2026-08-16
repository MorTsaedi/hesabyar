/**
 * Persian Number Utilities
 * Convert between Persian and English numerals
 * Format numbers with thousand separators
 */

// Persian digits
const PERSIAN_DIGITS: string[] = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
// Arabic-Indic digits (also used by some Persian keyboards)
const ARABIC_DIGITS: string[] = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ENGLISH_DIGITS: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function digitToEnglish(d: string): string {
  const pi = PERSIAN_DIGITS.indexOf(d);
  if (pi !== -1) return ENGLISH_DIGITS[pi];
  const ai = ARABIC_DIGITS.indexOf(d);
  if (ai !== -1) return ENGLISH_DIGITS[ai];
  return d;
}

/**
 * Convert English numbers to Persian numerals
 * "1234" → "۱۲۳۴"
 */
export function toPersianNumber(str: string | number): string {
  const numStr = String(str);
  return numStr.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

/**
 * Convert Persian/Arabic numerals to English numbers.
 * Also normalizes the Persian/Arabic decimal separator (٫) to "." and
 * strips thousands separators (٬ , ،) so the result is parseable.
 * "۱۲۳۴٫۵" → "1234.5"
 */
export function fromPersianNumber(str: string): string {
  return str
    .replace(/[۰-۹٠-٩]/g, digitToEnglish)
    .replace(/٫/g, '.')       // Arabic/Persian decimal separator (U+066B)
    .replace(/[٬,،]/g, '');    // Arabic thousands sep (U+066C), ASCII comma, Arabic comma (U+060C)
}

/**
 * Format a number with thousand separators and Persian digits
 * 1234567 → "۱,۲۳۴,۵۶۷"
 */
export function formatMoney(amount: number, currency: string = 'ریال'): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format with thousand separators
  const formatted = absAmount.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  
  const persianFormatted = toPersianNumber(formatted);
  const sign = isNegative ? '− ' : '';
  
  return `${sign}${persianFormatted} ${currency}`;
}

/**
 * Parse a Persian number string back to a number
 * "۱۲۳۴" → 1234
 */
export function parsePersianNumber(str: string | number): number {
  return parseFloat(fromPersianNumber(String(str ?? ''))) || 0;
}

/**
 * Format a number with Persian digits (no currency)
 * 1234.5 → "۱٬۲۳۴.۵"
 */
export function formatNumber(num: number, decimals: number = 0): string {
  const formatted = num.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  return toPersianNumber(formatted);
}

/**
 * Format a percentage with Persian digits
 * 0.15 → "۱۵٪"
 */
export function formatPercent(ratio: number): string {
  const percent = Math.round(ratio * 100);
  return `${toPersianNumber(percent)}٪`;
}
