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

export async function verifyAuthToken(authHeader?: string): Promise<{ uid: string; email?: string; role?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: (decodedToken.role as string) || 'employee',
    };
  } catch (error) {
    console.error('[FirebaseAdmin] Token verification failed:', error);
    return null;
  }
}
