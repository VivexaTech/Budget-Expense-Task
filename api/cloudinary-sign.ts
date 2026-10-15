import { VercelRequest, VercelResponse } from './_types';
import * as crypto from 'crypto';
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
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only company administrators can upload branding assets.' });
    }

    const companyId = authUser.companyId || 'company_vivexa';
    const folder = `companies/${companyId}/branding`;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'expense-manager';
    const apiKey = process.env.CLOUDINARY_API_KEY || 'cloudinary_key_placeholder';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'cloudinary_secret_placeholder';

    // Cloudinary signature: parameters alphabetically sorted, appended with secret, hashed with SHA-1
    // Parameters to sign: folder, timestamp
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    });
  } catch (error: any) {
    console.error('[Cloudinary Sign] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate upload signature.' });
  }
}
