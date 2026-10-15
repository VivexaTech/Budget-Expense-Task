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
    
    let totalCompanies = 0;
    let activeCompanies = 0;
    let suspendedCompanies = 0;
    const companyList: any[] = [];

    companiesSnap.forEach((doc) => {
      totalCompanies++;
      const data = doc.data();
      const status = data.status || 'ACTIVE';
      if (status === 'ACTIVE') {
        activeCompanies++;
      } else if (status === 'SUSPENDED') {
        suspendedCompanies++;
      }
      companyList.push({
        id: doc.id,
        name: data.name || 'Unnamed Company',
        slug: data.slug || doc.id,
        status,
        plan: data.plan || 'pro',
        ownerEmail: data.ownerEmail || '',
        createdAt: data.createdAt || '',
      });
    });

    // Query total users
    const usersSnap = await firestore.collection('users').get();
    const totalUsers = usersSnap.size;

    // Sort recent companies
    companyList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return res.status(200).json({
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      recentCompanies: companyList.slice(0, 5),
    });
  } catch (error: any) {
    console.error('[SuperAdmin Overview] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
