import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Client,
  ClientMetrics,
  ClientStatus,
  BillingPreference,
  UserProfile,
  IncomeTask,
} from '@/types';

/**
 * Check for duplicate client records by name or mobile number
 */
export async function searchDuplicateClients(
  clientName: string,
  mobileNumber: string,
  excludeClientId?: string
): Promise<{ byName: boolean; byPhone: boolean; matchedClients: Client[] }> {
  try {
    const clientsRef = collection(db, 'clients');
    const snapshot = await getDocs(clientsRef);
    const normalizedName = clientName.trim().toLowerCase();
    const cleanPhone = mobileNumber.replace(/\D/g, '').slice(-10);

    let byName = false;
    let byPhone = false;
    const matchedClients: Client[] = [];

    snapshot.forEach((docSnap) => {
      const c = docSnap.data() as Client;
      if (excludeClientId && c.id === excludeClientId) return;

      const cName = (c.clientName || '').trim().toLowerCase();
      const cPhone = (c.mobileNumber || '').replace(/\D/g, '').slice(-10);

      const nameMatch = normalizedName.length > 0 && cName === normalizedName;
      const phoneMatch = cleanPhone.length >= 10 && cPhone === cleanPhone;

      if (nameMatch || phoneMatch) {
        if (nameMatch) byName = true;
        if (phoneMatch) byPhone = true;
        matchedClients.push(c);
      }
    });

    return { byName, byPhone, matchedClients };
  } catch (error) {
    console.error('[ClientService] searchDuplicateClients error:', error);
    return { byName: false, byPhone: false, matchedClients: [] };
  }
}

/**
 * Create a new Client profile
 */
export async function createClient(
  data: {
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
  },
  currentUser: UserProfile
): Promise<Client> {
  const clientRef = doc(collection(db, 'clients'));
  const now = new Date().toISOString();

  const newClient: Client = {
    id: clientRef.id,
    clientName: data.clientName.trim(),
    companyName: data.companyName?.trim() || '',
    contactPerson: data.contactPerson?.trim() || '',
    mobileNumber: data.mobileNumber.trim(),
    email: data.email?.trim() || '',
    billingAddress: data.billingAddress?.trim() || '',
    city: data.city?.trim() || '',
    state: data.state.trim(),
    pincode: data.pincode?.trim() || '',
    gstin: data.gstin ? data.gstin.trim().toUpperCase() : '',
    clientNotes: data.clientNotes?.trim() || '',
    billingPreference: data.billingPreference || 'ASK_EVERY_TIME',
    assignedEmployeeId: data.assignedEmployeeId,
    assignedEmployeeName: data.assignedEmployeeName,
    createdByUid: currentUser.uid,
    createdByEmployeeId: currentUser.employeeId,
    createdByName: currentUser.displayName,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(clientRef, newClient);

  // Write audit log
  await addDoc(collection(db, 'activityLogs'), {
    actorUid: currentUser.uid,
    actorName: currentUser.displayName,
    actorRole: currentUser.role,
    action: 'CLIENT_CREATED',
    entityType: 'client',
    entityId: clientRef.id,
    description: `Created client profile: ${newClient.clientName} (Assigned to ${newClient.assignedEmployeeName})`,
    timestamp: now,
  });

  return newClient;
}

/**
 * Update an existing Client profile
 */
export async function updateClient(
  clientId: string,
  updates: Partial<Omit<Client, 'id' | 'createdAt' | 'createdByUid' | 'createdByEmployeeId' | 'createdByName'>>,
  currentUser: UserProfile
): Promise<void> {
  const clientRef = doc(db, 'clients', clientId);
  const now = new Date().toISOString();

  await updateDoc(clientRef, {
    ...updates,
    updatedAt: now,
  });

  await addDoc(collection(db, 'activityLogs'), {
    actorUid: currentUser.uid,
    actorName: currentUser.displayName,
    actorRole: currentUser.role,
    action: 'CLIENT_UPDATED',
    entityType: 'client',
    entityId: clientId,
    description: `Updated client profile: ${updates.clientName || clientId}`,
    timestamp: now,
  });
}

/**
 * Toggle Client status (Soft archive / activate)
 */
export async function toggleClientStatus(
  clientId: string,
  newStatus: ClientStatus,
  currentUser: UserProfile
): Promise<void> {
  const clientRef = doc(db, 'clients', clientId);
  const now = new Date().toISOString();

  await updateDoc(clientRef, {
    status: newStatus,
    updatedAt: now,
  });

  await addDoc(collection(db, 'activityLogs'), {
    actorUid: currentUser.uid,
    actorName: currentUser.displayName,
    actorRole: currentUser.role,
    action: 'CLIENT_UPDATED',
    entityType: 'client',
    entityId: clientId,
    description: `${newStatus === 'ACTIVE' ? 'Activated' : 'Archived'} client profile ${clientId}`,
    timestamp: now,
  });
}

/**
 * Fetch a single client by ID
 */
export async function getClient(clientId: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, 'clients', clientId));
  if (!snap.exists()) return null;
  return snap.data() as Client;
}

/**
 * Subscribe to clients collection with role-based filtering:
 * - Admins see all clients
 * - Employees see clients assigned to them or created by them
 */
export function subscribeToClients(
  currentUser: UserProfile,
  callback: (clients: Client[]) => void
) {
  const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const clients: Client[] = [];
      snapshot.forEach((docSnap) => {
        const c = docSnap.data() as Client;
        if (currentUser.role === 'admin') {
          clients.push(c);
        } else {
          // Employee: only see assigned or created
          if (
            c.assignedEmployeeId === currentUser.employeeId ||
            c.createdByUid === currentUser.uid
          ) {
            clients.push(c);
          }
        }
      });
      callback(clients);
    },
    (err) => {
      console.error('[ClientService] subscribeToClients error:', err);
    }
  );
}

/**
 * Calculate client metrics across all historical income tasks
 */
export async function calculateClientMetrics(clientId: string): Promise<ClientMetrics> {
  const q = query(collection(db, 'incomeTasks'), where('clientId', '==', clientId));
  const snapshot = await getDocs(q);

  let totalTasksCount = 0;
  let totalBusinessValue = 0;
  let totalAmountCollected = 0;
  let totalOutstandingAmount = 0;
  let paidTasksCount = 0;
  let partiallyPaidTasksCount = 0;
  let pendingTasksCount = 0;
  const dates: string[] = [];

  snapshot.forEach((docSnap) => {
    const t = docSnap.data() as IncomeTask;
    totalTasksCount += 1;
    totalBusinessValue += Number(t.expectedAmount || 0);
    totalAmountCollected += Number(t.receivedAmount || 0);
    totalOutstandingAmount += Number(t.remainingAmount || 0);

    if (t.status === 'COMPLETED') {
      paidTasksCount += 1;
    } else if (t.status === 'PARTIALLY_PAID') {
      partiallyPaidTasksCount += 1;
    } else if (t.status === 'PENDING') {
      pendingTasksCount += 1;
    }

    if (t.dueDate) dates.push(t.dueDate);
    if (t.createdAt) dates.push(t.createdAt.slice(0, 10));
  });

  dates.sort();
  const firstTransactionDate = dates.length > 0 ? dates[0] : undefined;
  const lastTransactionDate = dates.length > 0 ? dates[dates.length - 1] : undefined;

  return {
    totalTasksCount,
    totalBusinessValue,
    totalAmountCollected,
    totalOutstandingAmount,
    paidTasksCount,
    partiallyPaidTasksCount,
    pendingTasksCount,
    firstTransactionDate,
    lastTransactionDate,
  };
}

/**
 * Fetch all tasks associated with a client
 */
export async function getClientTasks(clientId: string): Promise<IncomeTask[]> {
  const q = query(
    collection(db, 'incomeTasks'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const tasks: IncomeTask[] = [];
  snapshot.forEach((d) => tasks.push(d.data() as IncomeTask));
  return tasks;
}
