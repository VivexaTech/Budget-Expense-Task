import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { normalizeStateName, isSameStateSupply } from '../src/constants/states';
import { Invoice, InvoiceType, ClientBillingSnapshot, SupplierBusinessSnapshot } from '../src/types';

function hashPin(pin: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(pin.trim()).digest('hex');
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

    // 2. Fetch Invoice Settings and verify PIN
    const settingsRef = firestore.collection('systemConfig').doc('invoiceSettings');
    const settingsSnap = await settingsRef.get();
    const settings = settingsSnap.data() || {};
    const pinSalt = settings.pinSalt || 'default_salt_vivexa';

    let matchedType: InvoiceType | null = null;

    if (settings.gpinHash && hashPin(cleanPin, pinSalt) === settings.gpinHash) {
      matchedType = 'GST';
    } else if (settings.npinHash && hashPin(cleanPin, pinSalt) === settings.npinHash) {
      matchedType = 'NON_GST';
    } else if (!settings.gpinHash && !settings.npinHash) {
      // Default initial fallback PINs before first admin configuration:
      // GPIN: '111111', NPIN: '222222'
      if (cleanPin === '111111') {
        matchedType = 'GST';
      } else if (cleanPin === '222222') {
        matchedType = 'NON_GST';
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

    // 3. Inspect Income Task
    const taskRef = firestore.collection('incomeTasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      return res.status(404).json({ error: 'Income collection task not found.' });
    }

    const task = taskSnap.data() || {};

    // IDEMPOTENCY: Check if an invoice was already generated for this task
    if (task.invoiceId) {
      const existingInvoiceSnap = await firestore.collection('invoices').doc(task.invoiceId).get();
      if (existingInvoiceSnap.exists) {
        return res.status(200).json({
          success: true,
          alreadyExists: true,
          message: `Invoice ${task.invoiceNumber || ''} has already been generated.`,
          invoice: existingInvoiceSnap.data(),
        });
      }
    }

    // Ensure task is completed or fully paid
    if (task.status !== 'COMPLETED' && (task.remainingAmount || 0) > 0) {
      return res.status(400).json({
        error: 'Invoices can only be generated for fully completed tasks with zero remaining balance.',
      });
    }

    // 4. Fetch Client details if available
    let clientBillingSnapshot: ClientBillingSnapshot = {
      clientId: task.clientId || '',
      clientName: task.clientName || 'Valued Client',
      mobileNumber: task.clientPhone || '',
      state: 'Maharashtra', // Default fallback
    };

    if (task.clientId) {
      const clientDoc = await firestore.collection('clients').doc(task.clientId).get();
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

    const supplierBusinessSnapshot: SupplierBusinessSnapshot = {
      businessName: settings.businessName || 'Vivexa Technologies',
      businessAddress: settings.businessAddress || 'Corporate Towers, Tech Park',
      city: settings.city || 'Mumbai',
      state: settings.state || 'Maharashtra',
      pincode: settings.pincode || '400001',
      gstin: settings.gstin || '',
      contactPhone: settings.contactPhone || '',
      contactEmail: settings.contactEmail || '',
      logoUrl: settings.logoUrl || '',
      paymentTerms: settings.paymentTerms || 'Payment due upon receipt.',
      invoiceNotes: settings.invoiceNotes || 'Thank you for your business.',
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
    const counterRef = firestore.collection('invoiceCounters').doc(counterDocId);
    const invoiceRef = firestore.collection('invoices').doc();
    const nowIso = dateObj.toISOString();
    const todayDate = nowIso.slice(0, 10);

    const invoiceResult = await firestore.runTransaction(async (transaction) => {
      // Re-read task to prevent race conditions
      const currentTaskDoc = await transaction.get(taskRef);
      if (!currentTaskDoc.exists) throw new Error('Task not found.');
      const currentTaskData = currentTaskDoc.data() || {};
      if (currentTaskData.invoiceId) {
        throw new Error('ALREADY_GENERATED');
      }

      const counterDoc = await transaction.get(counterRef);
      const currentSerial = counterDoc.exists ? Number(counterDoc.data()?.lastSerial || 0) : 0;
      const nextSerial = currentSerial + 1;
      const formattedSerial = String(nextSerial).padStart(3, '0');
      const invoiceNumber = `${prefix}-${currentMonthKey}-${formattedSerial}`;

      const newInvoice: Invoice = {
        id: invoiceRef.id,
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
        invoiceDate: todayDate,
        createdByUid: authUser.uid,
        createdByEmployeeId: authUser.email || 'Admin',
        createdByName: authUser.email || 'Admin',
        createdAt: nowIso,
        invoiceStatus: 'GENERATED',
      };

      // Set new invoice
      transaction.set(invoiceRef, newInvoice);

      // Update counter
      transaction.set(counterRef, {
        prefix,
        monthKey: currentMonthKey,
        lastSerial: nextSerial,
        updatedAt: nowIso,
      }, { merge: true });

      // Update task
      transaction.update(taskRef, {
        invoiceId: invoiceRef.id,
        invoiceNumber,
        invoiceStatus: 'GENERATED',
        updatedAt: nowIso,
      });

      // Write audit log
      const auditRef = firestore.collection('activityLogs').doc();
      transaction.set(auditRef, {
        actorUid: authUser.uid,
        actorName: authUser.email || 'User',
        actorRole: authUser.role || 'employee',
        action: 'INVOICE_GENERATED',
        entityType: 'invoice',
        entityId: invoiceRef.id,
        description: `Generated ${matchedType} Invoice ${invoiceNumber} for ₹${totalInvoiceAmount.toLocaleString('en-IN')}`,
        metadata: {
          invoiceNumber,
          invoiceType: matchedType,
          taskId,
          totalAmount: totalInvoiceAmount,
        },
        timestamp: nowIso,
      });

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
