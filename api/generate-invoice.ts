import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { normalizeStateName, isSameStateSupply } from '../src/constants/states';
import {
  Invoice,
  InvoiceType,
  ClientBillingSnapshot,
  SupplierBusinessSnapshot,
  InvoiceTemplateId,
  DEFAULT_INVOICE_TEMPLATES,
} from '../src/types';

function hashPin(pin: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(pin.trim()).digest('hex');
}

function cleanFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(cleanFirestoreData) as unknown as T;
  if (typeof input === 'object' && input.constructor === Object) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return input;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authUser = await verifyAuthToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { taskId, pin } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    if (!pin || !/^\d{6}$/.test(String(pin).trim())) {
      return res.status(400).json({ error: 'A valid 6-digit PIN is required.' });
    }

    const firestore = admin.firestore();
    const cleanPin = String(pin).trim();
    const companyId = authUser.companyId || 'company_vivexa';

    // 1. Check Rate Limiting for caller
    const rateLimitRef = firestore.collection('systemConfig').doc(`pinLimit_${authUser.uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    const nowMs = Date.now();

    if (rateLimitSnap.exists) {
      const rlData = rateLimitSnap.data() || {};
      const lockUntil = Number(rlData.lockUntil || 0);
      if (lockUntil > nowMs) {
        const remainingMinutes = Math.ceil((lockUntil - nowMs) / 60000);
        return res.status(429).json({
          error: `Too many failed PIN attempts. Account locked from generating invoices for ${remainingMinutes} minute(s).`,
        });
      }
    }

    // 2. Fetch Invoice Settings and verify PIN (Company scoped with legacy fallback)
    const companySettingsRef = firestore.collection('companies').doc(companyId).collection('settings').doc('general');
    const legacySettingsRef = firestore.collection('systemConfig').doc('invoiceSettings');
    let settingsSnap = await companySettingsRef.get();
    if (!settingsSnap.exists) {
      settingsSnap = await legacySettingsRef.get();
    }
    const settings = settingsSnap.data() || {};
    const pinSalt = settings.pinSalt || 'default_salt_vivexa';

    const hasGstin = Boolean(settings.gstin && String(settings.gstin).trim().length > 0);
    const allowAlternative = Boolean(settings.allowAlternativeInvoiceType);

    let matchedType: InvoiceType | null = null;

    // Resolve primary PIN hash (GST if has GSTIN, else Non-GST)
    const primaryHash = settings.primaryPinHash || (hasGstin ? settings.gpinHash : settings.npinHash);
    const isPrimaryMatch = primaryHash
      ? hashPin(cleanPin, pinSalt) === primaryHash
      : (cleanPin === '111111');

    // Resolve alternative PIN hash
    const alternativeHash = settings.alternativePinHash || (hasGstin ? settings.npinHash : settings.gpinHash);
    const isAlternativeMatch = alternativeHash
      ? hashPin(cleanPin, pinSalt) === alternativeHash
      : (cleanPin === '222222');

    if (isPrimaryMatch) {
      // Primary PIN: Default invoice type determined by GSTIN configuration
      matchedType = hasGstin ? 'GST' : 'NON_GST';
    } else if (isAlternativeMatch) {
      if (hasGstin) {
        // Company has GSTIN: can generate alternative Non-GST invoice ONLY if Super Admin granted permission
        if (allowAlternative) {
          matchedType = 'NON_GST';
        } else {
          matchedType = null;
        }
      } else {
        matchedType = null;
      }
    }

    if (!matchedType) {
      // Record failed attempt
      const rlData = rateLimitSnap.exists ? rateLimitSnap.data() || {} : {};
      const failedCount = (Number(rlData.failedCount || 0) + 1);
      const updates: Record<string, any> = {
        failedCount,
        lastAttempt: nowMs,
      };
      if (failedCount >= 5) {
        updates.lockUntil = nowMs + 15 * 60 * 1000; // 15 mins lock
      }
      await rateLimitRef.set(updates, { merge: true });

      return res.status(401).json({
        error: 'Invalid 6-digit authorization PIN. Please verify your PIN.',
      });
    }

    // Reset rate limits on success
    await rateLimitRef.delete().catch(() => {});

    // 3. Inspect Income Task (Check company scoped subcollection, then fallback to root)
    const companyTaskRef = firestore.collection('companies').doc(companyId).collection('incomeTasks').doc(taskId);
    let taskSnap = await companyTaskRef.get();
    let effectiveTaskRef = companyTaskRef;
    let isRootTask = false;

    if (!taskSnap.exists) {
      const rootTaskRef = firestore.collection('incomeTasks').doc(taskId);
      taskSnap = await rootTaskRef.get();
      if (taskSnap.exists) {
        effectiveTaskRef = rootTaskRef;
        isRootTask = true;
      }
    }

    if (!taskSnap.exists) {
      return res.status(404).json({ error: 'Income collection task not found.' });
    }

    const task = taskSnap.data() || {};

    // IDEMPOTENCY: Check if an invoice was already generated for this task
    if (task.invoiceId) {
      const companyInvoiceSnap = await firestore.collection('companies').doc(companyId).collection('invoices').doc(task.invoiceId).get();
      const rootInvoiceSnap = !companyInvoiceSnap.exists ? await firestore.collection('invoices').doc(task.invoiceId).get() : null;
      const existingDoc = companyInvoiceSnap.exists ? companyInvoiceSnap : rootInvoiceSnap;
      if (existingDoc && existingDoc.exists) {
        return res.status(200).json({
          success: true,
          alreadyExists: true,
          message: `Invoice ${task.invoiceNumber || ''} has already been generated.`,
          invoice: existingDoc.data(),
        });
      }
    }

    // Ensure task is completed or fully paid
    if (task.status !== 'COMPLETED' && (task.remainingAmount || 0) > 0) {
      return res.status(400).json({
        error: 'Invoices can only be generated for fully completed tasks with zero remaining balance.',
      });
    }

    // 4. Fetch Client details if available (Company subcollection, then fallback to root)
    let clientBillingSnapshot: ClientBillingSnapshot = {
      clientId: task.clientId || '',
      clientName: task.clientName || 'Valued Client',
      mobileNumber: task.clientPhone || '',
      state: 'Maharashtra', // Default fallback
    };

    if (task.clientId) {
      let clientDoc = await firestore.collection('companies').doc(companyId).collection('clients').doc(task.clientId).get();
      if (!clientDoc.exists) {
        clientDoc = await firestore.collection('clients').doc(task.clientId).get();
      }
      if (clientDoc.exists) {
        const c = clientDoc.data() || {};
        clientBillingSnapshot = {
          clientId: task.clientId,
          clientName: c.clientName || task.clientName,
          companyName: c.companyName || '',
          contactPerson: c.contactPerson || '',
          mobileNumber: c.mobileNumber || task.clientPhone || '',
          email: c.email || '',
          billingAddress: c.billingAddress || '',
          city: c.city || '',
          state: c.state || 'Maharashtra',
          pincode: c.pincode || '',
          gstin: c.gstin || '',
        };
      }
    }

    const selectedTemplateId: InvoiceTemplateId = (settings.selectedTemplateId as InvoiceTemplateId) || 'CORPORATE';
    const templateConfig = DEFAULT_INVOICE_TEMPLATES[selectedTemplateId] || DEFAULT_INVOICE_TEMPLATES.CORPORATE;

    const supplierBusinessSnapshot: SupplierBusinessSnapshot = {
      businessName: settings.businessName || authUser.companyName || 'Vivexa Technologies',
      businessAddress: settings.businessAddress || 'Corporate Towers, Tech Park',
      city: settings.city || 'Mumbai',
      state: settings.state || 'Maharashtra',
      pincode: settings.pincode || '400001',
      gstin: settings.gstin || '',
      contactPhone: settings.contactPhone || '',
      contactEmail: settings.contactEmail || authUser.email || '',
      logoUrl: settings.logoUrl || '',
      signatureUrl: settings.signatureUrl || '',
      bankDetails: settings.bankDetails || {
        bankName: settings.bankName || '',
        accountNumber: settings.accountNumber || '',
        ifscCode: settings.ifscCode || '',
        upiId: settings.upiId || '',
      },
      paymentTerms: settings.paymentTerms || templateConfig.paymentTerms || 'Payment due upon receipt.',
      invoiceNotes: settings.invoiceNotes || templateConfig.invoiceNotes || 'Thank you for your business.',
    };

    // 5. Calculate Taxes & Amounts
    const totalInvoiceAmount = Math.max(0, Math.round(Number(task.receivedAmount || task.expectedAmount || 0) * 100) / 100);
    const originalAmount = Math.max(totalInvoiceAmount, Math.round(Number(task.originalAmount || totalInvoiceAmount) * 100) / 100);
    const discountType = task.discountType || 'NONE';
    const discountValue = Number(task.discountValue || 0);
    const discountAmount = Number(task.discountAmount || 0);

    const gstRate = matchedType === 'GST' ? Number(settings.defaultGstRate !== undefined ? settings.defaultGstRate : 18) : 0;
    const sameState = isSameStateSupply(supplierBusinessSnapshot.state, clientBillingSnapshot.state);

    let taxableAmount = totalInvoiceAmount;
    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (matchedType === 'GST' && gstRate > 0) {
      taxableAmount = Math.round((totalInvoiceAmount / (1 + gstRate / 100)) * 100) / 100;
      const totalTax = Math.round((totalInvoiceAmount - taxableAmount) * 100) / 100;

      if (sameState) {
        cgstRate = Math.round((gstRate / 2) * 100) / 100;
        cgstAmount = Math.round((totalTax / 2) * 100) / 100;
        sgstRate = cgstRate;
        sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
      } else {
        igstRate = gstRate;
        igstAmount = totalTax;
      }
    }

    // 6. Atomic Monthly Counter Transaction
    const dateObj = new Date();
    const currentMonthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const prefix = matchedType === 'GST' ? 'VTX' : 'VTN';
    const counterDocId = `${prefix}_${currentMonthKey}`;
    
    // Scoped counter ref
    const companyCounterRef = firestore.collection('companies').doc(companyId).collection('invoiceCounters').doc(counterDocId);
    const legacyCounterRef = firestore.collection('invoiceCounters').doc(counterDocId);
    
    const newInvoiceId = firestore.collection('companies').doc(companyId).collection('invoices').doc().id;
    const companyInvoiceRef = firestore.collection('companies').doc(companyId).collection('invoices').doc(newInvoiceId);
    const rootInvoiceRef = firestore.collection('invoices').doc(newInvoiceId);
    
    const nowIso = dateObj.toISOString();
    const todayDate = nowIso.slice(0, 10);

    const invoiceResult = await firestore.runTransaction(async (transaction) => {
      // Re-read task to prevent race conditions
      const currentTaskDoc = await transaction.get(effectiveTaskRef);
      if (!currentTaskDoc.exists) throw new Error('Task not found.');
      const currentTaskData = currentTaskDoc.data() || {};
      if (currentTaskData.invoiceId) {
        throw new Error('ALREADY_GENERATED');
      }

      // Read counter: prefer company counter, fallback to legacy if company is legacy vivexa
      let counterDoc = await transaction.get(companyCounterRef);
      if (!counterDoc.exists && companyId === 'company_vivexa') {
        counterDoc = await transaction.get(legacyCounterRef);
      }
      
      const currentSerial = counterDoc.exists ? Number(counterDoc.data()?.lastSerial || 0) : 0;
      const nextSerial = currentSerial + 1;
      const formattedSerial = String(nextSerial).padStart(3, '0');
      const invoiceNumber = `${prefix}-${currentMonthKey}-${formattedSerial}`;

      const newInvoice: Invoice = {
        id: newInvoiceId,
        companyId,
        invoiceNumber,
        invoiceType: matchedType as InvoiceType,
        invoiceSerial: nextSerial,
        invoiceYear: dateObj.getFullYear(),
        invoiceMonth: currentMonthKey,
        clientId: clientBillingSnapshot.clientId,
        taskId,
        serviceName: task.projectName || 'Professional Services',
        originalAmount,
        discountType,
        discountValue,
        discountAmount,
        taxableAmount,
        gstRate,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        totalInvoiceAmount,
        amountPaidAtGeneration: totalInvoiceAmount,
        balanceDueAtGeneration: 0,
        isSameStateSupply: sameState,
        clientBillingDetailsSnapshot: clientBillingSnapshot,
        supplierBusinessDetailsSnapshot: supplierBusinessSnapshot,
        templateId: selectedTemplateId,
        templateSnapshot: templateConfig,
        invoiceDate: todayDate,
        createdByUid: authUser.uid,
        createdByEmployeeId: authUser.email || 'Admin',
        createdByName: authUser.email || 'Admin',
        createdAt: nowIso,
        invoiceStatus: 'GENERATED',
      };

      const cleanedData = cleanFirestoreData(newInvoice);

      // Save to company subcollection
      transaction.set(companyInvoiceRef, cleanedData);

      // Dual-write to root collection for backward compatibility
      transaction.set(rootInvoiceRef, cleanedData);

      // Update counters
      transaction.set(companyCounterRef, {
        prefix,
        monthKey: currentMonthKey,
        lastSerial: nextSerial,
        updatedAt: nowIso,
      }, { merge: true });

      if (companyId === 'company_vivexa') {
        transaction.set(legacyCounterRef, {
          prefix,
          monthKey: currentMonthKey,
          lastSerial: nextSerial,
          updatedAt: nowIso,
        }, { merge: true });
      }

      // Update task in both places if needed
      const taskUpdatePayload = cleanFirestoreData({
        invoiceId: newInvoiceId,
        invoiceNumber,
        invoiceStatus: 'GENERATED',
        updatedAt: nowIso,
      });

      transaction.update(effectiveTaskRef, taskUpdatePayload);
      if (!isRootTask) {
        // Also update root task if it exists for sync
        const rootTaskDoc = await transaction.get(firestore.collection('incomeTasks').doc(taskId));
        if (rootTaskDoc.exists) {
          transaction.update(rootTaskDoc.ref, taskUpdatePayload);
        }
      }

      // Write company activity log
      const companyAuditRef = firestore.collection('companies').doc(companyId).collection('activityLogs').doc();
      const auditPayload = cleanFirestoreData({
        companyId,
        actorUid: authUser.uid,
        actorName: authUser.email || 'User',
        actorRole: authUser.role || 'employee',
        action: 'INVOICE_GENERATED',
        entityType: 'invoice',
        entityId: newInvoiceId,
        description: `Generated ${matchedType} Invoice ${invoiceNumber} for ₹${totalInvoiceAmount.toLocaleString('en-IN')}`,
        metadata: {
          invoiceNumber,
          invoiceType: matchedType,
          taskId,
          totalAmount: totalInvoiceAmount,
        },
        timestamp: nowIso,
      });
      transaction.set(companyAuditRef, auditPayload);

      // Dual write audit log to root
      const rootAuditRef = firestore.collection('activityLogs').doc();
      transaction.set(rootAuditRef, auditPayload);

      return newInvoice;
    });

    return res.status(200).json({
      success: true,
      message: `Invoice ${invoiceResult.invoiceNumber} generated successfully.`,
      invoice: invoiceResult,
    });
  } catch (error: any) {
    if (error.message === 'ALREADY_GENERATED') {
      return res.status(409).json({ error: 'Invoice has already been generated for this task.' });
    }
    console.error('[GenerateInvoice API] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate invoice.' });
  }
}

