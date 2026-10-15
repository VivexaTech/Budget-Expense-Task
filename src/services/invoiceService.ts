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
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
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
 * Update invoice settings and configure authorization PINs (Admin only)
 */
export async function updateInvoiceSettings(
  settings: Partial<InvoiceSettings> & {
    authorizationPin?: string;
    alternativePin?: string;
    gpin?: string;
    npin?: string;
  }
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
export function subscribeToInvoices(
  callback: (invoices: Invoice[]) => void,
  companyId = 'company_vivexa'
) {
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const invoices: Invoice[] = [];
      snapshot.forEach((d) => {
        const inv = d.data() as Invoice;
        const invComp = inv.companyId || 'company_vivexa';
        if (invComp === companyId) {
          invoices.push(inv);
        }
      });
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
export async function getInvoiceById(invoiceId: string, companyId = 'company_vivexa'): Promise<Invoice | null> {
  try {
    let snap = await getDoc(doc(db, 'companies', companyId, 'invoices', invoiceId));
    if (!snap.exists()) {
      snap = await getDoc(doc(db, 'invoices', invoiceId));
    }
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

  // On Web, use the browser's native print/save-to-PDF dialog
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return '';
  }

  // Generate PDF file with base64 data
  // Base64 encoding allows us to write directly to the app's sandboxed documentDirectory.
  // This completely eliminates Android FilePermissionService rejection:
  // "Not allowed to read file under given URL" caused by unscoped Print cache directories.
  const { uri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  const cleanNumber = (invoice.invoiceNumber || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Invoice_${cleanNumber}.pdf`;
  const baseDir = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '').replace(/\/?$/, '/');
  const targetUri = `${baseDir}${fileName}`;

  let shareTarget = uri;

  try {
    if (base64) {
      await FileSystem.writeAsStringAsync(targetUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      shareTarget = targetUri;
    } else if (uri && uri !== targetUri) {
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });
      shareTarget = targetUri;
    }
  } catch (fsErr) {
    console.warn('[InvoiceService] FileSystem write/copy fallback:', fsErr);
    shareTarget = uri;
  }

  // Ensure file exists before calling Sharing
  try {
    const fileInfo = await FileSystem.getInfoAsync(shareTarget);
    if (!fileInfo.exists && uri) {
      shareTarget = uri;
    }
  } catch (infoErr) {
    console.warn('[InvoiceService] getInfoAsync error:', infoErr);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(shareTarget, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Invoice ${invoice.invoiceNumber}`,
    });
  }

  return shareTarget;
}
