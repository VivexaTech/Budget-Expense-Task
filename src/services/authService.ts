import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole, CompanyProfile, CompanyRegistrationPayload } from '@/types';
import { callBackendApi } from './apiClient';

/**
 * Sign in user with Firebase email & password
 */
export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const uid = userCredential.user.uid;

  const profile = await fetchUserProfile(uid);
  if (!profile) {
    throw new Error('User account profile not found in database. Contact administrator.');
  }

  if (!profile.active) {
    await firebaseSignOut(auth);
    throw new Error('This account has been deactivated by the company administrator.');
  }

  return profile;
}

/**
 * Register a new company workspace
 */
export async function registerCompanyAccount(payload: CompanyRegistrationPayload): Promise<{
  user: UserProfile;
  company: CompanyProfile;
}> {
  const result = await callBackendApi<{ user: UserProfile; company: CompanyProfile }>(
    '/api/register-company',
    'POST',
    payload
  );
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to register company.');
  }
  return result.data;
}

/**
 * Fetch company profile from Firestore
 */
export async function fetchCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId));
    if (snap.exists()) {
      return snap.data() as CompanyProfile;
    }
    return null;
  } catch (err) {
    console.error('[AuthService] Error fetching company profile:', err);
    return null;
  }
}

/**
 * Sign out current user
 */
export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Fetch user profile from Firestore users/{uid}
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      if (!data.companyId) {
        data.companyId = 'company_vivexa';
        data.companyName = 'Vivexa Technologies';
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('[AuthService] Error fetching user profile:', error);
    return null;
  }
}

/**
 * Update user's FCM device push token
 */
export async function updateUserPushToken(uid: string, token: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        pushToken: token,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('[AuthService] Successfully registered push token in Firestore for user:', uid);
  } catch (err) {
    console.warn('[AuthService] Could not update push token:', err);
  }
}

/**
 * Fetch all employees for a company (Admin only)
 */
export async function fetchAllEmployees(companyId = 'company_vivexa'): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), where('companyId', '==', companyId));
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    snap.forEach((d) => {
      list.push(d.data() as UserProfile);
    });
    if (list.length === 0 && companyId === 'company_vivexa') {
      // Fallback for legacy records without companyId tag
      const fallbackSnap = await getDocs(collection(db, 'users'));
      fallbackSnap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (!u.companyId || u.companyId === 'company_vivexa') {
          list.push(u);
        }
      });
    }
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    console.error('[AuthService] Error fetching employees:', error);
    return [];
  }
}

/**
 * Subscribe to employees list in real-time (Admin only)
 */
export function subscribeToEmployees(callback: (employees: UserProfile[]) => void, companyId = 'company_vivexa') {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  return onSnapshot(
    q,
    (snapshot) => {
      let employees: UserProfile[] = [];
      snapshot.forEach((doc) => {
        employees.push(doc.data() as UserProfile);
      });
      if (employees.length === 0 && companyId === 'company_vivexa') {
        getDocs(collection(db, 'users')).then((snap) => {
          const list: UserProfile[] = [];
          snap.forEach((d) => {
            const u = d.data() as UserProfile;
            if (!u.companyId || u.companyId === 'company_vivexa') {
              list.push(u);
            }
          });
          callback(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        });
      } else {
        callback(employees.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      }
    },
    (error) => {
      console.error('[AuthService] Error in employee subscription:', error);
    }
  );
}

/**
 * Toggle active state of employee account (Admin only)
 */
export async function toggleEmployeeAccountStatus(uid: string, active: boolean, adminUser: UserProfile): Promise<void> {
  const companyId = adminUser.companyId || 'company_vivexa';
  await updateDoc(doc(db, 'users', uid), {
    active,
    updatedAt: new Date().toISOString(),
  });

  // Log activity
  await setDoc(doc(collection(db, 'companies', companyId, 'activityLogs')), {
    id: doc(collection(db, 'companies', companyId, 'activityLogs')).id,
    companyId,
    actorUid: adminUser.uid,
    actorName: adminUser.displayName,
    actorRole: 'admin',
    action: 'EMPLOYEE_STATUS_CHANGED',
    entityType: 'user',
    entityId: uid,
    description: `${active ? 'Activated' : 'Deactivated'} employee account`,
    metadata: { active },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Reset employee password via Firebase Auth link
 */
export async function sendEmployeePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Create new employee via secure backend API (Admin only)
 * Does NOT sign out the administrator!
 */
export async function createEmployeeAccount(payload: {
  employeeId: string;
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserProfile> {
  const result = await callBackendApi<{ user: UserProfile }>('/api/create-employee', 'POST', payload);
  if (!result.success || !result.data?.user) {
    throw new Error(result.error || 'Failed to create employee account.');
  }
  return result.data.user;
}

