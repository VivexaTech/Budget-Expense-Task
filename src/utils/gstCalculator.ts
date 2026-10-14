import { isSameStateSupply } from '../constants/states';
import { InvoiceType } from '../types';

export interface TaxCalculationParams {
  amount: number; // Final gross/tax-inclusive amount
  gstRate: number; // e.g. 18
  invoiceType: InvoiceType;
  supplierState?: string;
  clientState?: string;
}

export interface TaxCalculationResult {
  invoiceType: InvoiceType;
  totalInvoiceAmount: number;
  taxableAmount: number;
  gstRate: number;
  isSameStateSupply: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
}

export interface DiscountCalculationParams {
  originalAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE' | 'NONE';
  discountValue: number;
}

export interface DiscountCalculationResult {
  originalAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE' | 'NONE';
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
}

/**
 * Calculates discount amount and final billable amount
 */
export function calculateDiscount(params: DiscountCalculationParams): DiscountCalculationResult {
  const { originalAmount, discountType, discountValue } = params;
  const orig = Math.max(0, Number(originalAmount) || 0);
  const val = Math.max(0, Number(discountValue) || 0);

  if (discountType === 'FIXED') {
    const discountAmount = Math.min(orig, Math.round(val * 100) / 100);
    const finalAmount = Math.round((orig - discountAmount) * 100) / 100;
    return {
      originalAmount: orig,
      discountType,
      discountValue: val,
      discountAmount,
      finalAmount,
    };
  }

  if (discountType === 'PERCENTAGE') {
    const cappedPercent = Math.min(100, val);
    const discountAmount = Math.round(((orig * cappedPercent) / 100) * 100) / 100;
    const finalAmount = Math.round((orig - discountAmount) * 100) / 100;
    return {
      originalAmount: orig,
      discountType,
      discountValue: val,
      discountAmount,
      finalAmount,
    };
  }

  return {
    originalAmount: orig,
    discountType: 'NONE',
    discountValue: 0,
    discountAmount: 0,
    finalAmount: orig,
  };
}

/**
 * Calculates tax-inclusive GST breakdown.
 * In India, consumer/service quotes are often inclusive of GST.
 * Taxable = Total / (1 + Rate / 100)
 * Tax = Total - Taxable
 * Split into CGST + SGST (intra-state) or IGST (inter-state)
 */
export function calculateTaxInclusiveGst(params: TaxCalculationParams): TaxCalculationResult {
  const { amount, gstRate, invoiceType, supplierState, clientState } = params;
  const total = Math.max(0, Math.round(Number(amount || 0) * 100) / 100);

  if (invoiceType === 'NON_GST' || gstRate <= 0) {
    return {
      invoiceType: 'NON_GST',
      totalInvoiceAmount: total,
      taxableAmount: total,
      gstRate: 0,
      isSameStateSupply: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
    };
  }

  const rate = Math.max(0, Number(gstRate) || 0);
  const taxable = Math.round((total / (1 + rate / 100)) * 100) / 100;
  const totalTax = Math.round((total - taxable) * 100) / 100;

  const sameState = isSameStateSupply(supplierState, clientState);

  if (sameState) {
    const halfRate = Math.round((rate / 2) * 100) / 100;
    const halfTax = Math.round((totalTax / 2) * 100) / 100;
    const remainingTax = Math.round((totalTax - halfTax) * 100) / 100; // Account for 1 paisa rounding

    return {
      invoiceType: 'GST',
      totalInvoiceAmount: total,
      taxableAmount: taxable,
      gstRate: rate,
      isSameStateSupply: true,
      cgstRate: halfRate,
      cgstAmount: halfTax,
      sgstRate: halfRate,
      sgstAmount: remainingTax,
      igstRate: 0,
      igstAmount: 0,
      totalTaxAmount: totalTax,
    };
  } else {
    return {
      invoiceType: 'GST',
      totalInvoiceAmount: total,
      taxableAmount: taxable,
      gstRate: rate,
      isSameStateSupply: false,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: rate,
      igstAmount: totalTax,
      totalTaxAmount: totalTax,
    };
  }
}
