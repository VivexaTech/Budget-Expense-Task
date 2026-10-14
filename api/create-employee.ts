import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authUser = await verifyAuthToken(req.headers.authorization);

    // Verify caller has admin privileges
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
    }

    const firestore = admin.firestore();
    const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
    const callerRole = callerDoc.data()?.role;

    if (callerRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }

    const { employeeId, displayName, email, password, role } = req.body;

    if (!employeeId || !displayName || !email || !password) {
      return res.status(400).json({ error: 'Missing required employee fields.' });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'employee';

    // Check if employeeId is unique
    const existingEmp = await firestore.collection('users').where('employeeId', '==', employeeId).get();
    if (!existingEmp.empty) {
      return res.status(400).json({ error: `Employee ID ${employeeId} already exists.` });
    }

    // 1. Create Firebase Auth user using Admin SDK (preserves caller session!)
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });

    // 2. Set Custom User Claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: assignedRole,
      employeeId,
    });

    const now = new Date().toISOString();

    // 3. Save profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      employeeId,
      displayName,
      email,
      role: assignedRole,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection('users').doc(userRecord.uid).set(userProfile);

    // 4. Record Audit Log
    await firestore.collection('activityLogs').add({
      actorUid: authUser.uid,
      actorName: callerDoc.data()?.displayName || 'Admin',
      actorRole: 'admin',
      action: 'EMPLOYEE_CREATED',
      entityType: 'user',
      entityId: userRecord.uid,
      description: `Created new ${assignedRole} account for ${displayName} (${employeeId})`,
      metadata: { employeeId, email, role: assignedRole },
      timestamp: now,
    });

    return res.status(201).json({
      success: true,
      message: `Employee account created successfully for ${displayName}`,
      user: {
        uid: userRecord.uid,
        employeeId,
        displayName,
        email,
        role: assignedRole,
      },
    });
  } catch (error: any) {
    console.error('[CreateEmployee] Error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
