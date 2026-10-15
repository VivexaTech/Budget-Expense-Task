import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from './_firebaseAdmin';

const DEFAULT_SUPER_ADMIN_EMAILS = [
  'admin@vivexatech.in',
  'superadmin@vivexatech.in',
  'superadmin@expensemanager.com',
];

export async function verifySuperAdmin(authHeader?: string): Promise<{
  uid: string;
  email?: string;
  isSuperAdmin: boolean;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email?.toLowerCase() || '';

    // 1. Check custom claim
    if (decodedToken.superAdmin === true) {
      return { uid: decodedToken.uid, email, isSuperAdmin: true };
    }

    // 2. Check allowlist from environment or default
    const envEmails = (process.env.SUPER_ADMIN_EMAILS || '')
      .toLowerCase()
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const allowlist = [...new Set([...DEFAULT_SUPER_ADMIN_EMAILS, ...envEmails])];
    if (email && allowlist.includes(email)) {
      return { uid: decodedToken.uid, email, isSuperAdmin: true };
    }

    // 3. Check Firestore user document
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      if (data.isSuperAdmin === true || data.role === 'super_admin') {
        return { uid: decodedToken.uid, email, isSuperAdmin: true };
      }
    }

    return null;
  } catch (err) {
    console.error('[SuperAdminAuth] Failed to verify super admin token:', err);
    return null;
  }
}
