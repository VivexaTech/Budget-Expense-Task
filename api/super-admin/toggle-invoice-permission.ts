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

    const { companyId, allowAlternativeInvoiceType } = req.body || {};
    if (!companyId || typeof allowAlternativeInvoiceType !== 'boolean') {
      return res.status(400).json({ error: 'Valid companyId and boolean allowAlternativeInvoiceType are required.' });
    }

    const firestore = admin.firestore();
    const settingsRef = firestore.collection('companies').doc(companyId).collection('settings').doc('general');
    const now = new Date().toISOString();

    await settingsRef.set(
      {
        allowAlternativeInvoiceType,
        updatedAt: now,
        updatedBy: superAdmin.email || superAdmin.uid,
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      companyId,
      allowAlternativeInvoiceType,
      message: `Alternative invoice type permission set to ${allowAlternativeInvoiceType}.`,
    });
  } catch (error: any) {
    console.error('[SuperAdmin Toggle Invoice Permission] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
