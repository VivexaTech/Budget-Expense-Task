import * as admin from 'firebase-admin';

let app: admin.app.App;

export function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Fallback for local development or mock environments
    console.warn('[FirebaseAdmin] No service account credentials found. Using default initialization.');
    app = admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'company-budget-demo',
    });
  }

  return app;
}

export async function verifyAuthToken(authHeader?: string): Promise<{
  uid: string;
  email?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    let role = (decodedToken.role as string) || 'employee';
    let companyId = (decodedToken.companyId as string) || '';
    let companyName = (decodedToken.companyName as string) || '';

    // Fallback: If companyId is not in custom claims, retrieve from Firestore user profile
    if (!companyId) {
      try {
        const firestore = admin.firestore();
        const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          companyId = userData.companyId || 'company_vivexa';
          companyName = userData.companyName || 'Vivexa Technologies';
          role = userData.role || role;
        } else {
          companyId = 'company_vivexa';
        }
      } catch {
        companyId = 'company_vivexa';
      }
    }

    // Check if company is suspended
    if (companyId && role !== 'super_admin') {
      try {
        const compDoc = await admin.firestore().collection('companies').doc(companyId).get();
        if (compDoc.exists && compDoc.data()?.status === 'SUSPENDED') {
          console.warn(`[FirebaseAdmin] Blocked request: Company ${companyId} is suspended.`);
          return null;
        }
      } catch {}
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      companyId,
      companyName,
    };
  } catch (error) {
    console.error('[FirebaseAdmin] Token verification failed:', error);
    return null;
  }
}
