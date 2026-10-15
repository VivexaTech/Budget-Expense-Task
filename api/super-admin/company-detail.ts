import { VercelRequest, VercelResponse } from '../_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '../_firebaseAdmin';
import { verifySuperAdmin } from '../_superAdminAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    getFirebaseAdmin();
    const superAdmin = await verifySuperAdmin(req.headers.authorization);
    if (!superAdmin) {
      return res.status(403).json({ error: 'Forbidden. Super Admin access required.' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Company ID is required.' });
    }

    const firestore = admin.firestore();
    const compDoc = await firestore.collection('companies').doc(id).get();
    if (!compDoc.exists) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const compData = compDoc.data() || {};

    // Fetch company settings
    const settingsDoc = await firestore.collection('companies').doc(id).collection('settings').doc('general').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() || {} : {};

    // Fetch company members
    const membersSnap = await firestore.collection('users').where('companyId', '==', id).get();
    const members: any[] = [];
    membersSnap.forEach((mDoc) => {
      const mData = mDoc.data();
      members.push({
        uid: mDoc.id,
        displayName: mData.displayName || '',
        email: mData.email || '',
        role: mData.role || 'employee',
        status: mData.status || 'ACTIVE',
        createdAt: mData.createdAt || '',
      });
    });

    return res.status(200).json({
      company: {
        id,
        name: compData.name || '',
        slug: compData.slug || id,
        status: compData.status || 'ACTIVE',
        plan: compData.plan || 'pro',
        ownerEmail: compData.ownerEmail || '',
        createdAt: compData.createdAt || '',
        updatedAt: compData.updatedAt || '',
        settings: {
          businessName: settingsData.businessName || compData.name || '',
          businessAddress: settingsData.businessAddress || '',
          city: settingsData.city || '',
          state: settingsData.state || '',
          pincode: settingsData.pincode || '',
          gstin: settingsData.gstin || compData.gstin || '',
          contactPhone: settingsData.contactPhone || '',
          contactEmail: settingsData.contactEmail || '',
          logoUrl: settingsData.logoUrl || '',
          signatureUrl: settingsData.signatureUrl || '',
          allowAlternativeInvoiceType: Boolean(settingsData.allowAlternativeInvoiceType),
        },
      },
      members,
    });
  } catch (error: any) {
    console.error('[SuperAdmin Company Detail] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
