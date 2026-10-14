import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getFirebaseAdmin, verifyAuthToken } from './_firebaseAdmin';

function hashPin(pin: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(pin.trim()).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    getFirebaseAdmin();
    const authUser = await verifyAuthToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const firestore = admin.firestore();
    const settingsDocRef = firestore.collection('systemConfig').doc('invoiceSettings');

    // GET: Return public business details & pin configuration status (no hashes!)
    if (req.method === 'GET') {
      const doc = await settingsDocRef.get();
      if (!doc.exists) {
        // Return default profile
        return res.status(200).json({
          businessName: 'Vivexa Technologies',
          businessAddress: 'Corporate Towers, Tech Park',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          gstin: '',
          contactPhone: '',
          contactEmail: '',
          defaultGstRate: 18,
          paymentTerms: 'Payment due upon receipt of invoice.',
          invoiceNotes: 'Thank you for your business.',
          hasGpinConfigured: false,
          hasNpinConfigured: false,
        });
      }

      const data = doc.data() || {};
      return res.status(200).json({
        businessName: data.businessName || 'Vivexa Technologies',
        businessAddress: data.businessAddress || '',
        city: data.city || '',
        state: data.state || 'Maharashtra',
        pincode: data.pincode || '',
        gstin: data.gstin || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        logoUrl: data.logoUrl || '',
        defaultGstRate: data.defaultGstRate !== undefined ? Number(data.defaultGstRate) : 18,
        paymentTerms: data.paymentTerms || 'Payment due upon receipt of invoice.',
        invoiceNotes: data.invoiceNotes || 'Thank you for your business.',
        hasGpinConfigured: !!data.gpinHash,
        hasNpinConfigured: !!data.npinHash,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
    }

    // POST / PUT: Update settings (Admin only)
    if (req.method === 'POST' || req.method === 'PUT') {
      const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
      const callerData = callerDoc.data();
      if (callerData?.role !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can update invoice settings.' });
      }

      const {
        businessName,
        businessAddress,
        city,
        state,
        pincode,
        gstin,
        contactPhone,
        contactEmail,
        logoUrl,
        defaultGstRate,
        paymentTerms,
        invoiceNotes,
        gpin,
        npin,
      } = req.body;

      if (!businessName || !businessAddress || !state) {
        return res.status(400).json({ error: 'Business Name, Address, and State are required.' });
      }

      const existingDoc = await settingsDocRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() || {} : {};

      let pinSalt = existingData.pinSalt;
      if (!pinSalt) {
        pinSalt = crypto.randomBytes(16).toString('hex');
      }

      const updates: Record<string, any> = {
        businessName: String(businessName).trim(),
        businessAddress: String(businessAddress).trim(),
        city: city ? String(city).trim() : '',
        state: String(state).trim(),
        pincode: pincode ? String(pincode).trim() : '',
        gstin: gstin ? String(gstin).trim().toUpperCase() : '',
        contactPhone: contactPhone ? String(contactPhone).trim() : '',
        contactEmail: contactEmail ? String(contactEmail).trim() : '',
        logoUrl: logoUrl || '',
        defaultGstRate: defaultGstRate !== undefined ? Number(defaultGstRate) : 18,
        paymentTerms: paymentTerms ? String(paymentTerms).trim() : 'Payment due upon receipt.',
        invoiceNotes: invoiceNotes ? String(invoiceNotes).trim() : 'Thank you for your business.',
        pinSalt,
        updatedAt: new Date().toISOString(),
        updatedBy: authUser.uid,
      };

      if (gpin) {
        if (!/^\d{6}$/.test(String(gpin).trim())) {
          return res.status(400).json({ error: 'GPIN must be exactly 6 numeric digits.' });
        }
        updates.gpinHash = hashPin(String(gpin).trim(), pinSalt);
      }

      if (npin) {
        if (!/^\d{6}$/.test(String(npin).trim())) {
          return res.status(400).json({ error: 'NPIN must be exactly 6 numeric digits.' });
        }
        updates.npinHash = hashPin(String(npin).trim(), pinSalt);
      }

      await settingsDocRef.set(updates, { merge: true });

      // Audit log
      await firestore.collection('activityLogs').add({
        actorUid: authUser.uid,
        actorName: callerData?.displayName || 'Admin',
        actorRole: 'admin',
        action: 'INVOICE_SETTINGS_UPDATED',
        entityType: 'settings',
        entityId: 'invoiceSettings',
        description: `Updated invoice configuration${gpin || npin ? ' and authorization PINs' : ''}.`,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: 'Invoice settings updated successfully.',
      });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error: any) {
    console.error('[InvoiceSettings API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}
