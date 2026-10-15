import { VercelRequest, VercelResponse } from './_types';
import * as crypto from 'crypto';
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
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only administrators can update branding assets.' });
    }

    const { dataUrl, assetType } = req.body || {};
    if (!dataUrl || !['logo', 'signature'].includes(assetType)) {
      return res.status(400).json({ error: 'dataUrl (base64) and assetType ("logo" | "signature") are required.' });
    }

    const companyId = authUser.companyId || 'company_vivexa';
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    let secureUrl = '';

    if (cloudName && apiKey && apiSecret) {
      // Cloudinary upload
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = `companies/${companyId}/branding`;
      const publicId = `${assetType}_${Date.now()}`;
      
      const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

      const formData = new URLSearchParams();
      formData.append('file', dataUrl);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('folder', folder);
      formData.append('public_id', publicId);
      formData.append('signature', signature);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const cloudJson: any = await cloudRes.json();
      if (!cloudRes.ok) {
        throw new Error(cloudJson.error?.message || 'Cloudinary upload failed.');
      }
      secureUrl = cloudJson.secure_url;
    } else {
      // Fallback: If Cloudinary credentials are not configured in demo/local environment,
      // return dataUrl or placeholder
      console.warn('[CloudinaryUpload] Cloudinary credentials not configured; using dataUrl directly.');
      secureUrl = dataUrl;
    }

    // Persist to company settings in Firestore
    const firestore = admin.firestore();
    const settingsRef = firestore.collection('companies').doc(companyId).collection('settings').doc('general');
    const fieldToUpdate = assetType === 'logo' ? 'logoUrl' : 'signatureUrl';
    
    await settingsRef.set(
      {
        [fieldToUpdate]: secureUrl,
        updatedAt: new Date().toISOString(),
        updatedBy: authUser.email || authUser.uid,
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      assetType,
      secureUrl,
      companyId,
    });
  } catch (error: any) {
    console.error('[CloudinaryUpload] Error:', error);
    return res.status(500).json({ error: error.message || 'Asset upload failed.' });
  }
}
