import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { db } from './firebase';
import { IncomeEntry, ExpenseEntry } from '@/types';
import { formatMonthName } from '@/utils/formatters';

interface CsvExportRow {
  date: string;
  type: 'Income' | 'Expense';
  employeeName: string;
  employeeId: string;
  description: string;
  category: string;
  paymentSource: string;
  paymentMode: string;
  amount: number;
  status: string;
  notes: string;
  rawDate: string;
}

/**
 * Escape a string for RFC 4180 CSV compliance
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Format ISO timestamp into readable Date & Time (YYYY-MM-DD HH:mm)
 */
function formatCsvDateTime(isoString?: string): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export interface ExportReportResult {
  success: boolean;
  totalRecords: number;
  incomeCount: number;
  expenseCount: number;
  totalIncomeAmount: number;
  totalExpenseAmount: number;
  monthKey: string;
  filePath?: string;
  message?: string;
}

/**
 * Generate and download/share a Monthly Income & Expense Report in CSV format
 * Restricts to monthKey, distinguishes payment source, handles empty months gracefully.
 */
export async function exportMonthlyFinancialReport(
  monthKey: string
): Promise<ExportReportResult> {
  // 1. Fetch Income records for the selected month
  const incomeQuery = query(
    collection(db, 'incomeEntries'),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'asc')
  );
  const incomeSnap = await getDocs(incomeQuery);
  const incomeRows: CsvExportRow[] = [];
  let totalIncomeAmount = 0;

  incomeSnap.forEach((doc) => {
    const inc = doc.data() as IncomeEntry;
    if (inc.status === 'VALID') {
      totalIncomeAmount += Number(inc.amount || 0);
    }
    const taskRefSuffix = inc.incomeTaskId ? ` [Task #${inc.incomeTaskId.slice(0, 8)}]` : '';
    const desc = inc.workDescription ? `${inc.workDescription}${taskRefSuffix}` : (taskRefSuffix || 'Client Payment');
    const cat = inc.collectedFrom ? `Client: ${inc.collectedFrom}` : 'Company Income';
    const source = inc.incomeTaskId ? 'Client Collection' : 'Client Deposit';

    incomeRows.push({
      date: formatCsvDateTime(inc.createdAt),
      type: 'Income',
      employeeName: inc.employeeNameSnapshot || 'N/A',
      employeeId: inc.employeeId || 'N/A',
      description: desc,
      category: cat,
      paymentSource: source,
      paymentMode: inc.paymentMode || 'CASH',
      amount: Number(inc.amount || 0),
      status: inc.status || 'VALID',
      notes: inc.notes || '',
      rawDate: inc.createdAt || '',
    });
  });

  // 2. Fetch Expense records for the selected month
  const expenseQuery = query(
    collection(db, 'expenseEntries'),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'asc')
  );
  const expenseSnap = await getDocs(expenseQuery);
  const expenseRows: CsvExportRow[] = [];
  let totalExpenseAmount = 0;

  expenseSnap.forEach((doc) => {
    const exp = doc.data() as ExpenseEntry;
    totalExpenseAmount += Number(exp.amount || 0);

    const isCompanyFund = exp.paymentSource === 'COMPANY_FUND';
    const sourceLabel = isCompanyFund
      ? 'By Company Fund'
      : 'By Self (Employee Paid)';
    const modeLabel = isCompanyFund
      ? 'COMPANY_FUND'
      : 'EMPLOYEE_PERSONAL';

    let statusLabel: string = exp.approvalStatus || 'SUBMITTED';
    if (isCompanyFund) {
      statusLabel = `${exp.approvalStatus} (Company Fund)`;
    } else {
      statusLabel = `${exp.approvalStatus} (${exp.reimbursementStatus === 'PAID' ? 'Reimbursed' : 'Unpaid'})`;
    }

    const desc = exp.description
      ? `${exp.title} - ${exp.description}`
      : exp.title;

    expenseRows.push({
      date: formatCsvDateTime(exp.createdAt),
      type: 'Expense',
      employeeName: exp.employeeNameSnapshot || 'N/A',
      employeeId: exp.employeeId || 'N/A',
      description: desc,
      category: exp.category || 'General Expense',
      paymentSource: sourceLabel,
      paymentMode: modeLabel,
      amount: Number(exp.amount || 0),
      status: statusLabel,
      notes: exp.rejectionReason || '',
      rawDate: exp.createdAt || '',
    });
  });

  // 3. Combine and sort chronologically (rawDate ASC)
  const allRows: CsvExportRow[] = [...incomeRows, ...expenseRows].sort((a, b) =>
    a.rawDate.localeCompare(b.rawDate)
  );

  // 4. Build CSV content with UTF-8 BOM
  const headers = [
    'Date',
    'Type',
    'Employee Name',
    'Employee ID',
    'Description',
    'Category',
    'Payment Source',
    'Payment Mode',
    'Amount',
    'Status',
    'Notes',
  ];

  const csvLines: string[] = [];
  // UTF-8 Byte Order Mark (\uFEFF) ensures Excel opens Unicode characters cleanly
  csvLines.push(headers.map(escapeCsvCell).join(','));

  for (const row of allRows) {
    const rowValues = [
      row.date,
      row.type,
      row.employeeName,
      row.employeeId,
      row.description,
      row.category,
      row.paymentSource,
      row.paymentMode,
      row.amount.toFixed(2),
      row.status,
      row.notes,
    ];
    csvLines.push(rowValues.map(escapeCsvCell).join(','));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const fileName = `Financial_Report_${monthKey}.csv`;

  // 5. Handle Platform-specific file delivery
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return {
      success: true,
      totalRecords: allRows.length,
      incomeCount: incomeRows.length,
      expenseCount: expenseRows.length,
      totalIncomeAmount,
      totalExpenseAmount,
      monthKey,
      message: `Exported ${allRows.length} records for ${formatMonthName(monthKey)}.`,
    };
  }

  // Native Android/iOS delivery using expo-file-system and expo-sharing
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  const fileUri = `${baseDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export Monthly Report - ${formatMonthName(monthKey)}`,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return {
    success: true,
    totalRecords: allRows.length,
    incomeCount: incomeRows.length,
    expenseCount: expenseRows.length,
    totalIncomeAmount,
    totalExpenseAmount,
    monthKey,
    filePath: fileUri,
    message: `Exported ${allRows.length} records for ${formatMonthName(monthKey)}.`,
  };
}
