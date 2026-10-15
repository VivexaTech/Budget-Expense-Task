import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { IncomeEntry, PaymentMode, UserProfile } from '@/types';
import { callBackendApi } from './apiClient';
import { recalculateTaskEligibility } from './taskService';

/**
 * Add a new income entry (Employee or Admin)
 * Automatically attaches authenticated user's identity snapshots
 */
export async function submitIncomeEntry(
  data: {
    amount: number;
    collectedFrom: string;
    workDescription: string;
    paymentMode: PaymentMode;
    monthKey: string;
    notes?: string;
  },
  user: UserProfile
): Promise<IncomeEntry> {
  const companyId = user.companyId || 'company_vivexa';
  const newRef = doc(collection(db, 'incomeEntries'));
  const now = new Date().toISOString();

  const entry: IncomeEntry = {
    id: newRef.id,
    companyId,
    employeeId: user.employeeId,
    employeeUid: user.uid,
    employeeNameSnapshot: user.displayName,
    amount: Number(data.amount),
    collectedFrom: data.collectedFrom.trim(),
    workDescription: data.workDescription.trim(),
    paymentMode: data.paymentMode,
    monthKey: data.monthKey,
    notes: data.notes?.trim() || '',
    createdAt: now,
    status: 'VALID',
  };

  await setDoc(newRef, entry);
  await setDoc(doc(db, 'companies', companyId, 'incomeEntries', entry.id), entry);

  // Record audit log
  const auditData = {
    companyId,
    actorUid: user.uid,
    actorName: user.displayName,
    actorRole: user.role,
    action: 'INCOME_ADDED',
    entityType: 'income',
    entityId: newRef.id,
    description: `${user.displayName} recorded income of ₹${entry.amount.toLocaleString('en-IN')} from ${entry.collectedFrom}`,
    metadata: {
      amount: entry.amount,
      client: entry.collectedFrom,
      paymentMode: entry.paymentMode,
      monthKey: entry.monthKey,
    },
    timestamp: now,
  };
  await setDoc(doc(collection(db, 'companies', companyId, 'activityLogs')), auditData);
  await setDoc(doc(collection(db, 'activityLogs')), auditData);

  // Recalculate task eligibility immediately in Firestore so newly funded tasks become READY_TO_COMPLETE
  await recalculateTaskEligibility(data.monthKey);

  // Re-evaluate eligibility on backend and trigger notifications
  try {
    const recalcResult = await callBackendApi('/api/recalculate-eligibility', 'POST', {
      monthKey: data.monthKey,
    });

    if (recalcResult.success && recalcResult.data?.evaluation?.newlyReadyTasks?.length > 0) {
      for (const readyTask of recalcResult.data.evaluation.newlyReadyTasks) {
        await callBackendApi('/api/send-notification', 'POST', {
          eventId: `READY_${readyTask.id}_${data.monthKey}`,
          targetTaskId: readyTask.id,
          title: 'Company Task Ready for Review',
          body: `${readyTask.title} — ₹${Number(readyTask.amount).toLocaleString('en-IN')} is financially ready for review.`,
        });
      }
    }
  } catch (err) {
    console.warn('[IncomeService] Background recalculation warning:', err);
  }

  return entry;
}

/**
 * Void an income entry (Admin only, auditable correction)
 */
export async function voidIncomeEntry(
  incomeId: string,
  reason: string,
  adminUser: UserProfile,
  monthKey: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'incomeEntries', incomeId), {
    status: 'VOID',
    voidedBy: adminUser.uid,
    voidReason: reason,
    updatedAt: now,
  });

  // Audit log
  await setDoc(doc(collection(db, 'activityLogs')), {
    id: doc(collection(db, 'activityLogs')).id,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'INCOME_VOIDED',
    entityType: 'income',
    entityId: incomeId,
    description: `Voided income record ID ${incomeId}: ${reason}`,
    timestamp: now,
  });

  // Re-evaluate eligibility because available balance has decreased
  await callBackendApi('/api/recalculate-eligibility', 'POST', { monthKey });
}

/**
 * Subscribe to all valid income entries for a given monthKey (Company-wide)
 */
export function subscribeToMonthIncome(
  monthKey: string,
  callback: (entries: IncomeEntry[]) => void,
  companyId = 'company_vivexa'
) {
  const q = query(
    collection(db, 'incomeEntries'),
    where('monthKey', '==', monthKey),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: IncomeEntry[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as IncomeEntry;
        const itemCompany = item.companyId || 'company_vivexa';
        if (itemCompany === companyId) {
          list.push(item);
        }
      });
      callback(list);
    },
    (err) => {
      console.error('[IncomeService] Month income subscription error:', err);
    }
  );
}

/**
 * Subscribe to an employee's own income entries
 */
export function subscribeToEmployeeIncome(
  employeeUid: string,
  callback: (entries: IncomeEntry[]) => void
) {
  const q = query(
    collection(db, 'incomeEntries'),
    where('employeeUid', '==', employeeUid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: IncomeEntry[] = [];
      snapshot.forEach((d) => list.push(d.data() as IncomeEntry));
      callback(list);
    },
    (err) => {
      console.error('[IncomeService] Employee income subscription error:', err);
    }
  );
}
