import { VercelRequest, VercelResponse } from '../_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '../_firebaseAdmin';
import { verifySuperAdmin } from '../_superAdminAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const superAdmin = await verifySuperAdmin(req.headers.authorization);
    if (!superAdmin) {
      return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
    }

    const { companyId, status } = req.body || {};
    if (!companyId || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Valid companyId and status (ACTIVE | SUSPENDED) are required.' });
    }

    const firestore = admin.firestore();
    const compRef = firestore.collection('companies').doc(companyId);
    const compDoc = await compRef.get();
    if (!compDoc.exists) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const now = new Date().toISOString();
    await compRef.set(
      {
        status,
        updatedAt: now,
        statusChangedBy: superAdmin.email || superAdmin.uid,
      },
      { merge: true }
    );

    // Audit log
    await firestore.collection('activityLogs').add({
      companyId,
      actorUid: superAdmin.uid,
      actorName: superAdmin.email || 'Super Admin',
      actorRole: 'super_admin',
      action: status === 'ACTIVE' ? 'COMPANY_ACTIVATED' : 'COMPANY_SUSPENDED',
      description: `Company ${status === 'ACTIVE' ? 'activated' : 'suspended'} by Super Admin.`,
      timestamp: now,
    });

    return res.status(200).json({
      success: true,
      companyId,
      status,
      message: `Company status updated to ${status}. Financial records preserved.`,
    });
  } catch (error: any) {
    console.error('[SuperAdmin Toggle Status] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
