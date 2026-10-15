export type UserRole = 'admin' | 'employee' | 'super_admin';
export type PaymentSource = 'SELF_PAID' | 'COMPANY_FUND';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
export type FinancialTaskStatus = 'PENDING' | 'READY_TO_COMPLETE' | 'COMPLETED' | 'CANCELLED';
export type IncomeTaskStatus = 'PENDING' | 'PARTIALLY_PAID' | 'COMPLETED' | 'CANCELLED';
export type BillingPreference = 'GST' | 'NON_GST';
export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';
export type InvoiceTemplateId = 'CORPORATE' | 'MINIMAL' | 'MODERN_BLUE' | 'CLASSIC_GST';

export interface UserProfile {
  uid: string;
  employeeId: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  companyId?: string;
  companyName?: string;
  createdAt: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName?: string;
  gstin?: string;
  adminUid: string;
  adminEmail: string;
  active: boolean;
  createdAt: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

export interface FinancialTask {
  id: string;
  companyId?: string;
  title: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  notes?: string;
  status: FinancialTaskStatus;
  allocatedAmount?: number;
  completedAt?: string;
  completedByUid?: string;
  completedByName?: string;
}

export interface IncomeEntry {
  id: string;
  companyId?: string;
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
  status: 'VALID' | 'VOIDED';
}

export interface ExpenseEntry {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeUid: string;
  employeeNameSnapshot: string;
  groupId: string;
  amount: number;
  category: string;
  description: string;
  paymentSource: PaymentSource;
  reimbursementStatus?: 'NOT_APPLICABLE' | 'PENDING' | 'REIMBURSED';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  date: string;
  createdAt: string;
}

export interface Client {
  id: string;
  companyId?: string;
  clientName: string;
  companyName?: string;
  contactPerson?: string;
  mobile: string;
  email?: string;
  billingAddress?: string;
  city?: string;
  state: string;
  pinCode?: string;
  gstin?: string;
  billingPreference: BillingPreference;
  notes?: string;
  assignedEmployeeUid: string;
  assignedEmployeeName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface IncomePaymentRecord {
  id: string;
  amount: number;
  paymentMode: PaymentMode;
  date: string;
  receivedByUid: string;
  receivedByEmployeeId: string;
  receivedByName: string;
  notes?: string;
  incomeEntryId?: string;
  nextDueDate?: string;
}

export interface IncomeTask {
  id: string;
  companyId?: string;
  clientId: string;
  clientName: string;
  clientMobile?: string;
  expectedAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  dueDate: string;
  reminderDate?: string | null;
  projectName: string;
  notes?: string;
  createdByUid: string;
  createdByName: string;
  createdByEmployeeId: string;
  status: IncomeTaskStatus;
  billingPreference?: BillingPreference;
  payments: IncomePaymentRecord[];
  monthKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: BillingPreference;
  companyId?: string;
  taskId: string;
  clientId: string;
  clientName: string;
  clientGstin?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  clientPinCode?: string;
  clientPhone?: string;
  clientEmail?: string;
  companyName: string;
  companyGstin?: string;
  companyAddress?: string;
  companyState?: string;
  originalAmount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  finalTotalAmount: number;
  roundOff: number;
  monthKey: string;
  createdAt: string;
  generatedByUid: string;
  generatedByName: string;
  description: string;
  status: 'ISSUED' | 'CANCELLED';
  templateId?: InvoiceTemplateId;
}

export interface InvoiceSettings {
  companyId?: string;
  companyName: string;
  gstin?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  email: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  termsAndConditions: string;
  notes: string;
  activeTemplateId: InvoiceTemplateId;
}
