import { format, parseISO, parse, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Format number as Indian Rupee currency (e.g. ₹35,000 or ₹1,20,500)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  
  // Format with standard Indian Numbering System if possible
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return `₹${formatted}`;
}

/**
 * Format standard ISO date or date string into human readable Google-style format
 * e.g. "15 Oct 2026" or "Due 5 Nov"
 */
export function formatReadableDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return format(d, 'dd MMM yyyy');
  } catch {
    return String(dateInput);
  }
}

/**
 * Format due date concisely, e.g. "Due 15 Oct"
 */
export function formatDueDate(dateStr: string): string {
  try {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    return `Due ${format(d, 'd MMM')}`;
  } catch {
    return `Due ${dateStr}`;
  }
}

/**
 * Format timestamp into time + date, e.g. "13 Oct, 02:45 PM"
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return format(d, 'dd MMM, hh:mm a');
  } catch {
    return String(dateInput);
  }
}

/**
 * Get current month key in YYYY-MM format
 */
export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Format YYYY-MM into readable format like "October 2026"
 */
export function formatMonthName(monthKey: string): string {
  try {
    const d = parse(monthKey, 'yyyy-MM', new Date());
    return format(d, 'MMMM yyyy');
  } catch {
    return monthKey;
  }
}

/**
 * Shift monthKey by offset (+1 for next month, -1 for previous)
 */
export function shiftMonthKey(monthKey: string, offset: number): string {
  try {
    const d = parse(monthKey, 'yyyy-MM', new Date());
    const shifted = offset >= 0 ? addMonths(d, offset) : subMonths(d, Math.abs(offset));
    return format(shifted, 'yyyy-MM');
  } catch {
    return monthKey;
  }
}

/**
 * Get start and end dates for a monthKey
 */
export function getMonthBoundaries(monthKey: string) {
  const d = parse(monthKey, 'yyyy-MM', new Date());
  return {
    start: startOfMonth(d),
    end: endOfMonth(d),
  };
}
