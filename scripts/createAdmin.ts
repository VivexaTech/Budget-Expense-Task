/**
 * Script to provision or elevate an Administrator account.
 * 
 * Usage:
 *   npx ts-node scripts/createAdmin.ts <email> <password> <displayName> [employeeId]
 * 
 * Example:
 *   npx ts-node scripts/createAdmin.ts admin@mycompany.com AdminPass123! "Chief Financial Officer" EMP-001
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(`
=============================================================
  COMPANY BUDGET & TASK MANAGER - ADMIN PROVISIONING TOOL
=============================================================

Usage:
  npx ts-node scripts/createAdmin.ts <email> <password> <displayName> [employeeId]

Example:
  npx ts-node scripts/createAdmin.ts admin@company.com MySecurePass123! "Rajesh Kumar" EMP-001

Prerequisites:
  Provide Firebase Admin credentials via either:
  1. A serviceAccountKey.json file in the root folder, OR
  2. Environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
=============================================================
`);
    process.exit(1);
  }

  const [email, password, displayName, employeeId = 'EMP-ADMIN-01'] = args;

  // Initialize Firebase Admin
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[FirebaseAdmin] Initialized using serviceAccountKey.json');
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('[FirebaseAdmin] Initialized using environment variables');
  } else {
    console.log('[FirebaseAdmin] Initializing with project ID or Google default application credentials...');
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  const auth = admin.auth();
  const firestore = admin.firestore();

  let uid: string;

  try {
    // 1. Check if user already exists in Firebase Auth
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`[Auth] Existing user found (UID: ${userRecord.uid}). Updating credentials & role...`);
      userRecord = await auth.updateUser(userRecord.uid, {
        password,
        displayName,
        emailVerified: true,
      });
      uid = userRecord.uid;
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log(`[Auth] Creating new user for ${email}...`);
        userRecord = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: true,
        });
        uid = userRecord.uid;
      } else {
        throw e;
      }
    }

    // 2. Set Admin Custom User Claims
    await auth.setCustomUserClaims(uid, {
      role: 'admin',
      employeeId,
    });
    console.log(`[Auth] Custom claims assigned: { role: 'admin', employeeId: '${employeeId}' }`);

    // 3. Write user profile to Firestore
    const now = new Date().toISOString();
    const userDocRef = firestore.collection('users').doc(uid);
    const existingDoc = await userDocRef.get();

    const profileData = {
      uid,
      employeeId,
      displayName,
      email,
      role: 'admin',
      active: true,
      updatedAt: now,
      createdAt: existingDoc.exists ? (existingDoc.data()?.createdAt || now) : now,
    };

    await userDocRef.set(profileData, { merge: true });
    console.log(`[Firestore] Profile saved at users/${uid}`);

    console.log(`
=============================================================
  SUCCESS! ADMIN ACCOUNT PROVISIONED
=============================================================
  UID:          ${uid}
  Display Name: ${displayName}
  Email:        ${email}
  Employee ID:  ${employeeId}
  Role:         admin
  Active:       true
=============================================================
You can now sign in on the mobile app using these credentials!
`);
  } catch (err: any) {
    console.error('[Error] Failed to provision admin account:', err.message);
    process.exit(1);
  }
}

main();
