import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { db } from './firebase';
import { callBackendApi } from './apiClient';
import { Invoice, InvoiceSettings } from '@/types';
import { generateInvoiceHtml } from '../utils/invoicePdfTemplate';

/**
 * Generate invoice via secure backend API (verifies PIN, increments serial counter atomically)
 */
export async function generateInvoice(
  taskId: string,
  pin: string
): Promise<{ success: boolean; invoice?: Invoice; error?: string; alreadyExists?: boolean }> {
  const result = await callBackendApi<{ invoice: Invoice; alreadyExists?: boolean }>(
    '/api/generate-invoice',
    'POST',
    { taskId, pin }
  );

  if (!result.success || !result.data?.invoice) {
    return {
      success: false,
      error: result.error || 'Failed to generate invoice.',
    };
  }

  return {
    success: true,
    invoice: result.data.invoice,
    alreadyExists: result.data.alreadyExists,
  };
}

/**
 * Fetch invoice settings / business details from backend
 */
export async function getInvoiceSettings(): Promise<InvoiceSettings | null> {
  const result = await callBackendApi<InvoiceSettings>('/api/invoice-settings', 'GET');
  if (!result.success || !result.data) {
    return null;
  }
  return result.data;
}

/**
 * Update invoice settings and configure GPIN / NPIN (Admin only)
 */
export async function updateInvoiceSettings(
  settings: Partial<InvoiceSettings> & { gpin?: string; npin?: string }
): Promise<{ success: boolean; error?: string }> {
  const result = await callBackendApi('/api/invoice-settings', 'POST', settings);
  return {
    success: result.success,
    error: result.error,
  };
}

/**
 * Subscribe to all generated invoices
 */
export function subscribeToInvoices(callback: (invoices: Invoice[]) => void) {
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const invoices: Invoice[] = [];
      snapshot.forEach((d) => invoices.push(d.data() as Invoice));
      callback(invoices);
    },
    (err) => {
      console.error('[InvoiceService] subscribeToInvoices error:', err);
    }
  );
}

/**
 * Get an invoice by its document ID
 */
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  try {
    const snap = await getDoc(doc(db, 'invoices', invoiceId));
    if (!snap.exists()) return null;
    return snap.data() as Invoice;
  } catch (err) {
    console.error('[InvoiceService] getInvoiceById error:', err);
    return null;
  }
}

/**
 * Get all invoices for a specific client
 */
export async function getInvoicesForClient(clientId: string): Promise<Invoice[]> {
  try {
    const q = query(
      collection(db, 'invoices'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const invoices: Invoice[] = [];
    snap.forEach((d) => invoices.push(d.data() as Invoice));
    return invoices;
  } catch (err) {
    console.error('[InvoiceService] getInvoicesForClient error:', err);
    return [];
  }
}

/**
 * Dynamically generate local PDF using expo-print and share using expo-sharing.
 * No cloud storage required!
 */
export async function generateAndShareInvoicePdf(invoice: Invoice): Promise<string> {
  const html = generateInvoiceHtml(invoice);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: '.pdf',
      dialogTitle: `Invoice ${invoice.invoiceNumber}`,
    });
  }

  return uri;
}
