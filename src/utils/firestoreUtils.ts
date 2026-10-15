import { IncomePaymentRecord } from '@/types';

/**
 * Recursively removes all keys with `undefined` values from an object or array.
 * Firestore strictly rejects `undefined` values anywhere in documents, maps, or arrays.
 * Preserves `null`, empty strings, numbers, booleans, arrays, and nested objects.
 */
export function removeUndefinedFields<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => removeUndefinedFields(item)) as unknown as T;
  }

  if (typeof input === 'object' && input.constructor === Object) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
    return cleaned as T;
  }

  return input;
}

/**
 * Sanitizes an IncomePaymentRecord to ensure no field is undefined before saving to Firestore.
 * Omits `nextDueDate` if not present/applicable so Firestore arrays don't contain undefined.
 */
export function sanitizePaymentRecord(
  record: Partial<IncomePaymentRecord>
): IncomePaymentRecord {
  const sanitized: IncomePaymentRecord = {
    id: record.id || `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: Number(record.amount || 0),
    paymentMode: record.paymentMode || 'CASH',
    date: record.date || new Date().toISOString(),
    receivedByUid: record.receivedByUid || '',
    receivedByEmployeeId: record.receivedByEmployeeId || '',
    receivedByName: record.receivedByName || '',
    notes: (record.notes || '').trim(),
    incomeEntryId: record.incomeEntryId || '',
  };

  if (record.nextDueDate && record.nextDueDate.trim()) {
    sanitized.nextDueDate = record.nextDueDate.trim();
  }

  return sanitized;
}
