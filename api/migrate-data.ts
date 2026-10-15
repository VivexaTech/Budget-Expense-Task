import { VercelRequest, VercelResponse } from './_types';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';
import { runMultiTenantMigration } from '../scripts/migrate-to-multitenant';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    getFirebaseAdmin();
    const authHeader = req.headers['authorization'];
    const cronSecretHeader = req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (expectedSecret && (authHeader === `Bearer ${expectedSecret}` || cronSecretHeader === expectedSecret)) {
      isAuthorized = true;
    } else {
      const authUser = await verifyAuthToken(authHeader);
      if (authUser && authUser.role === 'admin') {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials or secret required.' });
    }

    const { targetCompanyId, companyName } = req.body || {};
    const results = await runMultiTenantMigration(
      targetCompanyId || 'company_vivexa',
      companyName || 'Vivexa Technologies'
    );

    return res.status(200).json({
      success: true,
      message: 'Multi-tenant migration executed safely without data deletion.',
      results,
    });
  } catch (error: any) {
    console.error('[MigrateData API] Error:', error);
    return res.status(500).json({ error: error.message || 'Migration failed.' });
  }
}
