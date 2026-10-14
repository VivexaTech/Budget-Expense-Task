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
}

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
  reviewStatus: 'PENDING' | 'REVIEWED';
  createdAt: string;
  updatedAt: string;
}

export type ActivityAction =
  | 'INCOME_ADDED'
  | 'INCOME_VOIDED'
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
  | 'EMPLOYEE_STATUS_CHANGED';

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: 'admin' | 'employee' | 'system';
  action: ActivityAction;
  entityType: 'task' | 'income' | 'expense' | 'budget' | 'user';
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
