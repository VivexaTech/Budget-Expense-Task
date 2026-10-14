import { z } from 'zod';

export type UserRole = 'admin' | 'employee';

export interface UserProfile {
  uid: string;
  employeeId: string;
  displayName: string;
  email: string;
  role: UserRole;
  active: boolean;
  pushToken?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MonthlyBudget {
  monthKey: string; // Format: YYYY-MM
  timezone: string;
  fixedExpenseBudget: number;
  additionalExpectedExpenses: number;
  profitTarget: number;
  monthlyTarget: number;
  openingBalance: number;
  isOverridden?: boolean;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type TaskStatus = 'PENDING' | 'READY_TO_COMPLETE' | 'COMPLETED' | 'CANCELLED';
export type TaskType = 'FIXED' | 'RECURRING';

export interface FinancialTask {
  id: string;
  title: string;
  amount: number;
  description?: string;
  category?: string;
  monthKey: string;
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
  taskType: TaskType;
  allocatedAmount: number;
  recurrenceKey?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  completedBy?: string;
  completedAt?: string;
  paymentNotes?: string;
  eligibilityReason?: string;
}

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  amount: number;
  description?: string;
  category?: string;
  dueDayOfMonth: number; // 1 to 28
  active: boolean;
  recurrenceKey: string;
  createdAt: string;
}

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

export interface IncomeEntry {
  id: string;
  employeeId: string;
  employeeUid: string;
  employeeNameSnapshot: string;
  amount: number;
  collectedFrom: string;
  workDescription: string;
  paymentMode: PaymentMode;
  monthKey: string;
  notes?: string;
  createdAt: string;
  status: 'VALID' | 'VOID';
  incomeTaskId?: string;
}

export type IncomeTaskStatus = 'PENDING' | 'PARTIALLY_PAID' | 'COMPLETED' | 'CANCELLED';

export interface IncomePaymentRecord {
  id: string;
  amount: number;
  paymentMode: PaymentMode;
  date: string;
  receivedByUid: string;
  receivedByEmployeeId: string;
  receivedByName: string;
  notes?: string;
  nextDueDate?: string;
  incomeEntryId: string;
}

export interface IncomeTask {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  projectName: string;
  originalAmount?: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  discountAmount?: number;
  expectedAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  dueDate: string; // YYYY-MM-DD
  reminderDate?: string; // YYYY-MM-DD
  notes?: string;
  monthKey: string; // YYYY-MM
  status: IncomeTaskStatus;
  invoicePreference?: BillingPreference;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceStatus?: 'NOT_GENERATED' | 'GENERATED' | 'SKIPPED';
  createdByUid: string;
  createdByEmployeeId: string;
  createdByName: string;
  assignedToUid?: string;
  assignedToEmployeeId?: string;
  assignedToName?: string;
  payments: IncomePaymentRecord[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface IncomeCollectionMetrics {
  totalOutstandingCollections: number;
  amountDueToday: number;
  amountOverdue: number;
  amountCollectedThisMonth: number;
  totalTasksCount: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  dueTodayCount: number;
  overdueCount: number;
}

export type ExpensePaymentSource = 'SELF' | 'COMPANY_FUND';
export type ExpenseApprovalStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type ReimbursementStatus = 'UNPAID' | 'PAID';

export interface ExpenseEntry {
  id: string;
  employeeId: string;
  employeeUid: string;
  employeeNameSnapshot: string;
  title: string;
  description?: string;
  amount: number;
  monthKey: string;
  category?: string;
  receiptUrl?: string;
  paymentSource: ExpensePaymentSource;
  approvalStatus: ExpenseApprovalStatus;
  reimbursementStatus: ReimbursementStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ExpenseGroup {
  id: string; // "${employeeId}_${monthKey}"
  employeeId: string;
  employeeUid: string;
  employeeNameSnapshot: string;
  monthKey: string;
  totalAmount: number;
  entryCount: number;
  approvedAmount: number;
  companyFundAmount?: number;
  selfPaidAmount?: number;
  reviewStatus: 'PENDING' | 'REVIEWED';
  createdAt: string;
  updatedAt: string;
}

/**
 * Determine if an expense entry constitutes an actual company cash outflow
 */
export function isCompanyExpenseOutflow(entry: ExpenseEntry): boolean {
  if (entry.approvalStatus === 'REJECTED') {
    return false;
  }
  // Company fund payments deduct from available balance immediately upon entry
  if (entry.paymentSource === 'COMPANY_FUND') {
    return true;
  }
  // By Self (employee-paid) payments only deduct once approved and reimbursed
  return entry.approvalStatus === 'APPROVED' && entry.reimbursementStatus === 'PAID';
}

/**
 * Calculate total company cash outflows from an array of expense entries
 */
export function calculateCompanyExpenseOutflows(entries: ExpenseEntry[]): number {
  return entries.reduce((sum, e) => {
    return isCompanyExpenseOutflow(e) ? sum + Number(e.amount || 0) : sum;
  }, 0);
}

export type ActivityAction =
  | 'INCOME_ADDED'
  | 'INCOME_VOIDED'
  | 'INCOME_TASK_CREATED'
  | 'INCOME_TASK_PAYMENT'
  | 'INCOME_TASK_UPDATED'
  | 'INCOME_TASK_CANCELLED'
  | 'EXPENSE_SUBMITTED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'EXPENSE_REIMBURSED'
  | 'TASK_CREATED'
  | 'TASK_READY'
  | 'TASK_COMPLETED'
  | 'TASK_CANCELLED'
  | 'BUDGET_UPDATED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_STATUS_CHANGED'
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_SETTINGS_UPDATED';

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: 'admin' | 'employee' | 'system';
  action: ActivityAction;
  entityType: 'task' | 'income' | 'expense' | 'budget' | 'user' | 'client' | 'invoice' | 'settings';
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface NotificationEvent {
  id: string;
  eventType: 'TASK_READY' | 'EXPENSE_STATUS_CHANGE' | 'TASK_COMPLETED';
  targetTaskId?: string;
  recipientUid: string;
  idempotencyKey: string;
  title: string;
  body: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt?: string;
  retryCount: number;
}

export interface DashboardFinancials {
  monthKey: string;
  monthlyIncomeTarget: number;
  incomeCollected: number;
  actualCompanyExpensesPaid: number;
  pendingExpensesSubmitted: number;
  remainingIncomeTarget: number;
  availableCompanyBalance: number;
  targetProgressPercentage: number;
  openingBalance: number;
  totalOutstandingReadyTasksAmount: number;
  totalOutstandingPendingTasksAmount: number;
}

// =======================
// ZOD VALIDATION SCHEMAS
// =======================

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid company email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const IncomeEntrySchema = z.object({
  amount: z.number().positive('Income amount must be greater than zero'),
  collectedFrom: z.string().min(2, 'Client or payer name is required'),
  workDescription: z.string().min(3, 'Work description is required'),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  notes: z.string().optional(),
});

export const ExpenseEntrySchema = z.object({
  title: z.string().min(2, 'Expense title is required'),
  amount: z.number().positive('Expense amount must be greater than zero'),
  paymentSource: z.enum(['SELF', 'COMPANY_FUND']),
  description: z.string().optional(),
  category: z.string().optional(),
  receiptUrl: z.string().optional(),
});

export const TaskCreateSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  amount: z.number().positive('Task amount must be greater than zero'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  description: z.string().optional(),
  category: z.string().optional(),
});

export const RecurringTemplateSchema = z.object({
  title: z.string().min(2, 'Recurring title is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  dueDayOfMonth: z.number().min(1).max(28, 'Day of month must be between 1 and 28'),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const BudgetConfigSchema = z.object({
  fixedExpenseBudget: z.number().min(0, 'Fixed budget cannot be negative'),
  additionalExpectedExpenses: z.number().min(0, 'Additional expenses cannot be negative'),
  profitTarget: z.number().min(0, 'Profit target cannot be negative'),
  openingBalance: z.number().min(0, 'Opening balance cannot be negative'),
  isOverridden: z.boolean().optional(),
  overrideTarget: z.number().optional(),
  overrideReason: z.string().optional(),
});

export const CreateEmployeeSchema = z.object({
  employeeId: z.string().min(2, 'Employee ID is required (e.g. EMP-101)'),
  displayName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Temporary password must be at least 6 characters'),
  role: z.enum(['admin', 'employee']),
});

export const CreateIncomeTaskSchema = z.object({
  clientName: z.string().min(2, 'Client name is required'),
  clientPhone: z.string().optional(),
  projectName: z.string().min(2, 'Project / service name is required'),
  expectedAmount: z.number().positive('Expected amount must be greater than zero'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  reminderDate: z.string().optional(),
  notes: z.string().optional(),
});

export const RecordIncomePaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  notes: z.string().optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Next due date must be in YYYY-MM-DD format').optional().or(z.literal('')),
});

// ==========================================
// CLIENT MANAGEMENT TYPES
// ==========================================

export type BillingPreference = 'INVOICE_REQUIRED' | 'INVOICE_NOT_REQUIRED' | 'ASK_EVERY_TIME';
export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export interface Client {
  id: string;
  clientName: string;
  companyName?: string;
  contactPerson?: string;
  mobileNumber: string;
  email?: string;
  billingAddress?: string;
  city?: string;
  state: string;
  pincode?: string;
  gstin?: string;
  clientNotes?: string;
  billingPreference: BillingPreference;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  createdByUid: string;
  createdByEmployeeId: string;
  createdByName: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClientMetrics {
  totalTasksCount: number;
  totalBusinessValue: number;
  totalAmountCollected: number;
  totalOutstandingAmount: number;
  paidTasksCount: number;
  partiallyPaidTasksCount: number;
  pendingTasksCount: number;
  firstTransactionDate?: string;
  lastTransactionDate?: string;
}

export const ClientCreateSchema = z.object({
  clientName: z.string().min(2, 'Client name must be at least 2 characters'),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  mobileNumber: z.string().min(10, 'Valid 10-digit mobile number is required'),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  billingAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().min(2, 'State is required for GST billing'),
  pincode: z.string().regex(/^\d{6}$/, 'PIN Code must be 6 digits').optional().or(z.literal('')),
  gstin: z.string().optional(),
  clientNotes: z.string().optional(),
  billingPreference: z.enum(['INVOICE_REQUIRED', 'INVOICE_NOT_REQUIRED', 'ASK_EVERY_TIME']),
  assignedEmployeeId: z.string().min(1, 'Assigned employee is required'),
});

// ==========================================
// INVOICE SYSTEM TYPES
// ==========================================

export type InvoiceType = 'GST' | 'NON_GST';
export type InvoiceStatus = 'GENERATED' | 'CANCELLED';

export interface ClientBillingSnapshot {
  clientId: string;
  clientName: string;
  companyName?: string;
  contactPerson?: string;
  mobileNumber: string;
  email?: string;
  billingAddress?: string;
  city?: string;
  state: string;
  pincode?: string;
  gstin?: string;
}

export interface SupplierBusinessSnapshot {
  businessName: string;
  businessAddress: string;
  city?: string;
  state: string;
  pincode?: string;
  gstin?: string;
  contactPhone?: string;
  contactEmail?: string;
  logoUrl?: string;
  paymentTerms?: string;
  invoiceNotes?: string;
}

export interface Invoice {
  id: string; // Document ID
  invoiceNumber: string; // e.g. VTX-2026-10-001 or VTN-2026-10-001
  invoiceType: InvoiceType;
  invoiceSerial: number;
  invoiceYear: number;
  invoiceMonth: string; // YYYY-MM
  clientId: string;
  taskId: string;
  serviceName: string;
  originalAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE' | 'NONE';
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number; // e.g. 18
  cgstRate: number; // e.g. 9
  cgstAmount: number;
  sgstRate: number; // e.g. 9
  sgstAmount: number;
  igstRate: number; // e.g. 18
  igstAmount: number;
  totalInvoiceAmount: number;
  amountPaidAtGeneration: number;
  balanceDueAtGeneration: number;
  isSameStateSupply: boolean;
  clientBillingDetailsSnapshot: ClientBillingSnapshot;
  supplierBusinessDetailsSnapshot: SupplierBusinessSnapshot;
  invoiceDate: string; // YYYY-MM-DD
  createdByUid: string;
  createdByEmployeeId: string;
  createdByName: string;
  createdAt: string;
  invoiceStatus: InvoiceStatus;
}

export interface InvoiceSettings {
  businessName: string;
  businessAddress: string;
  city?: string;
  state: string;
  pincode?: string;
  gstin?: string;
  contactPhone?: string;
  contactEmail?: string;
  logoUrl?: string;
  defaultGstRate: number; // e.g. 18
  paymentTerms?: string;
  invoiceNotes?: string;
  updatedAt?: string;
  updatedBy?: string;
  hasGpinConfigured?: boolean;
  hasNpinConfigured?: boolean;
}

export const InvoiceSettingsSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  businessAddress: z.string().min(3, 'Business address is required'),
  city: z.string().optional(),
  state: z.string().min(2, 'Business state is required'),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  defaultGstRate: z.number().min(0).max(28),
  paymentTerms: z.string().optional(),
  invoiceNotes: z.string().optional(),
});

