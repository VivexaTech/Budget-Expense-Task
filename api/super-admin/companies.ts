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

    const firestore = admin.firestore();
    const companiesSnap = await firestore.collection('companies').get();
    const allUsersSnap = await firestore.collection('users').get();

    // Map member counts per company
    const memberCounts: Record<string, number> = {};
    allUsersSnap.forEach((uDoc) => {
      const uData = uDoc.data();
      const compId = uData.companyId || 'company_vivexa';
      memberCounts[compId] = (memberCounts[compId] || 0) + 1;
    });

    const companies: any[] = [];
    for (const doc of companiesSnap.docs) {
      const data = doc.data();
      const companyId = doc.id;

      // Check general settings for GSTIN and confidential permissions
      let gstin = data.gstin || '';
      let allowAlternativeInvoiceType = false;
      try {
        const settingsDoc = await firestore.collection('companies').doc(companyId).collection('settings').doc('general').get();
        if (settingsDoc.exists) {
          const sData = settingsDoc.data() || {};
          gstin = sData.gstin || gstin;
          allowAlternativeInvoiceType = Boolean(sData.allowAlternativeInvoiceType);
        }
      } catch {}

      companies.push({
        id: companyId,
        name: data.name || 'Unnamed Company',
        slug: data.slug || companyId,
        status: data.status || 'ACTIVE',
        plan: data.plan || 'pro',
        ownerEmail: data.ownerEmail || '',
        gstin,
        memberCount: memberCounts[companyId] || 0,
        allowAlternativeInvoiceType,
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      });
    }

    companies.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return res.status(200).json({
      companies,
      totalCount: companies.length,
    });
  } catch (error: any) {
    console.error('[SuperAdmin Companies] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
