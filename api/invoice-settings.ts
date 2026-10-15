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
    const companyId = authUser.companyId || 'company_vivexa';
    const companySettingsRef = firestore.collection('companies').doc(companyId).collection('settings').doc('general');
    const legacySettingsRef = firestore.collection('systemConfig').doc('invoiceSettings');

    // GET: Return public business details & pin configuration status (no hashes!)
    if (req.method === 'GET') {
      let doc = await companySettingsRef.get();
      if (!doc.exists) {
        doc = await legacySettingsRef.get();
      }

      if (!doc.exists) {
        return res.status(200).json({
          companyId,
          businessName: authUser.companyName || 'My Company',
          businessAddress: '',
          city: '',
          state: 'Maharashtra',
          pincode: '',
          gstin: '',
          contactPhone: '',
          contactEmail: authUser.email || '',
          defaultGstRate: 18,
          paymentTerms: 'Payment due upon receipt of invoice.',
          invoiceNotes: 'Thank you for your business.',
          selectedTemplateId: 'CORPORATE',
          hasAuthorizationPinConfigured: false,
          hasAlternativePinConfigured: false,
          allowAlternativeInvoiceType: false,
          defaultInvoiceType: 'NON_GST',
          // Legacy backwards compatibility:
          hasGpinConfigured: false,
          hasNpinConfigured: false,
        });
      }

      const data = doc.data() || {};
      const hasGstin = Boolean(data.gstin && String(data.gstin).trim().length > 0);
      const allowAlternativeInvoiceType = Boolean(data.allowAlternativeInvoiceType);
      
      const hasPrimary = Boolean(data.primaryPinHash || (hasGstin ? data.gpinHash : data.npinHash));
      const hasAlternative = Boolean(data.alternativePinHash || (hasGstin ? data.npinHash : data.gpinHash));

      return res.status(200).json({
        companyId,
        businessName: data.businessName || authUser.companyName || 'My Company',
        businessAddress: data.businessAddress || '',
        city: data.city || '',
        state: data.state || 'Maharashtra',
        pincode: data.pincode || '',
        gstin: data.gstin || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        logoUrl: data.logoUrl || '',
        signatureUrl: data.signatureUrl || '',
        defaultGstRate: data.defaultGstRate !== undefined ? Number(data.defaultGstRate) : 18,
        paymentTerms: data.paymentTerms || 'Payment due upon receipt of invoice.',
        invoiceNotes: data.invoiceNotes || 'Thank you for your business.',
        selectedTemplateId: data.selectedTemplateId || 'CORPORATE',
        bankDetails: data.bankDetails || {
          bankName: data.bankName || '',
          accountNumber: data.accountNumber || '',
          ifscCode: data.ifscCode || '',
          upiId: data.upiId || '',
        },
        hasAuthorizationPinConfigured: hasPrimary,
        hasAlternativePinConfigured: hasAlternative,
        allowAlternativeInvoiceType,
        defaultInvoiceType: hasGstin ? 'GST' : 'NON_GST',
        // Legacy compatibility
        hasGpinConfigured: hasGstin ? hasPrimary : false,
        hasNpinConfigured: hasGstin ? hasAlternative : hasPrimary,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
    }

    // POST / PUT: Update settings (Admin only)
    if (req.method === 'POST' || req.method === 'PUT') {
      const callerDoc = await firestore.collection('users').doc(authUser.uid).get();
      const callerData = callerDoc.data();
      if (callerData?.role !== 'admin' && callerData?.role !== 'super_admin') {
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
        signatureUrl,
        defaultGstRate,
        paymentTerms,
        invoiceNotes,
        selectedTemplateId,
        bankDetails,
        // Neutral PIN keys
        authorizationPin,
        alternativePin,
        // Legacy keys
        gpin,
        npin,
      } = req.body;

      if (!businessName || !businessAddress || !state) {
        return res.status(400).json({ error: 'Business Name, Address, and State are required.' });
      }

      let existingDoc = await companySettingsRef.get();
      if (!existingDoc.exists) {
        existingDoc = await legacySettingsRef.get();
      }
      const existingData = existingDoc.exists ? existingDoc.data() || {} : {};

      let pinSalt = existingData.pinSalt;
      if (!pinSalt) {
        pinSalt = crypto.randomBytes(16).toString('hex');
      }

      const cleanGstin = gstin ? String(gstin).trim().toUpperCase() : '';
      const hasGstin = cleanGstin.length > 0;
      const allowAlternativeInvoiceType = Boolean(existingData.allowAlternativeInvoiceType);

      const updates: Record<string, any> = {
        companyId,
        businessName: String(businessName).trim(),
        businessAddress: String(businessAddress).trim(),
        city: city ? String(city).trim() : '',
        state: String(state).trim(),
        pincode: pincode ? String(pincode).trim() : '',
        gstin: cleanGstin,
        contactPhone: contactPhone ? String(contactPhone).trim() : '',
        contactEmail: contactEmail ? String(contactEmail).trim() : '',
        logoUrl: logoUrl !== undefined ? logoUrl : existingData.logoUrl || '',
        signatureUrl: signatureUrl !== undefined ? signatureUrl : existingData.signatureUrl || '',
        defaultGstRate: defaultGstRate !== undefined ? Number(defaultGstRate) : 18,
        paymentTerms: paymentTerms ? String(paymentTerms).trim() : 'Payment due upon receipt.',
        invoiceNotes: invoiceNotes ? String(invoiceNotes).trim() : 'Thank you for your business.',
        selectedTemplateId: selectedTemplateId || existingData.selectedTemplateId || 'CORPORATE',
        bankDetails: bankDetails || existingData.bankDetails || {},
        pinSalt,
        updatedAt: new Date().toISOString(),
        updatedBy: authUser.uid,
      };

      // Resolve primary PIN from authorizationPin or legacy gpin/npin
      const resolvedPrimaryPin = authorizationPin || (hasGstin ? gpin : npin);
      if (resolvedPrimaryPin) {
        if (!/^\d{6}$/.test(String(resolvedPrimaryPin).trim())) {
          return res.status(400).json({ error: 'Authorization PIN must be exactly 6 numeric digits.' });
        }
        const primaryHash = hashPin(String(resolvedPrimaryPin).trim(), pinSalt);
        updates.primaryPinHash = primaryHash;
        if (hasGstin) {
          updates.gpinHash = primaryHash;
        } else {
          updates.npinHash = primaryHash;
        }
      }

      // Resolve alternative PIN
      const resolvedAlternativePin = alternativePin || (hasGstin ? npin : undefined);
      if (resolvedAlternativePin) {
        if (!/^\d{6}$/.test(String(resolvedAlternativePin).trim())) {
          return res.status(400).json({ error: 'Alternative Authorization PIN must be exactly 6 numeric digits.' });
        }
        const altHash = hashPin(String(resolvedAlternativePin).trim(), pinSalt);
        updates.alternativePinHash = altHash;
        updates.npinHash = altHash;
      }

      // Save to company settings
      await companySettingsRef.set(updates, { merge: true });

      // Audit log
      await firestore.collection('companies').doc(companyId).collection('activityLogs').add({
        companyId,
        actorUid: authUser.uid,
        actorName: callerData?.displayName || 'Admin',
        actorRole: 'admin',
        action: 'INVOICE_SETTINGS_UPDATED',
        entityType: 'settings',
        entityId: 'general',
        description: `Updated invoice configuration${resolvedPrimaryPin || resolvedAlternativePin ? ' and authorization PIN' : ''}.`,
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
