import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';

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

    // Verify caller has admin privileges
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
    }

    const firestore = admin.firestore();
    const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
    const callerRole = callerDoc.data()?.role;
    const companyId = authUser.companyId || callerDoc.data()?.companyId || 'company_vivexa';
    const companyName = authUser.companyName || callerDoc.data()?.companyName || 'Vivexa Technologies';

    if (callerRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }

    const { employeeId, displayName, email, password, role } = req.body;

    if (!employeeId || !displayName || !email || !password) {
      return res.status(400).json({ error: 'Missing required employee fields.' });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'employee';

    // Check if employeeId is unique within this company
    const existingEmp = await firestore
      .collection('companies')
      .doc(companyId)
      .collection('members')
      .where('employeeId', '==', employeeId)
      .get();
    if (!existingEmp.empty) {
      return res.status(400).json({ error: `Employee ID ${employeeId} already exists in your company.` });
    }

    // 1. Create Firebase Auth user using Admin SDK
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });

    // 2. Set Custom User Claims with companyId
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: assignedRole,
      employeeId,
      companyId,
      companyName,
    });

    const now = new Date().toISOString();

    // 3. Save profile in global users and company members
    const userProfile = {
      uid: userRecord.uid,
      employeeId,
      displayName,
      email,
      role: assignedRole,
      active: true,
      companyId,
      companyName,
      createdAt: now,
      updatedAt: now,
    };

    const batch = firestore.batch();
    batch.set(firestore.collection('users').doc(userRecord.uid), userProfile);
    batch.set(
      firestore.collection('companies').doc(companyId).collection('members').doc(userRecord.uid),
      {
        userId: userRecord.uid,
        companyId,
        role: assignedRole,
        employeeId,
        displayName,
        email,
        active: true,
        joinedAt: now,
      }
    );

    // 4. Record Audit Log in company scope
    const auditRef = firestore.collection('companies').doc(companyId).collection('activityLogs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      companyId,
      actorUid: authUser.uid,
      actorName: callerDoc.data()?.displayName || 'Admin',
      actorRole: 'admin',
      action: 'EMPLOYEE_CREATED',
      entityType: 'user',
      entityId: userRecord.uid,
      description: `Created new ${assignedRole} account for ${displayName} (${employeeId})`,
      metadata: { employeeId, email, role: assignedRole, companyId },
      timestamp: now,
    });

    await batch.commit();

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
