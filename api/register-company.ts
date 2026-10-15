import { VercelRequest, VercelResponse } from './_types';
import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from './_firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let createdUid: string | null = null;

  try {
    getFirebaseAdmin();
    const { companyName, adminName, email, password, confirmPassword, phone, state } = req.body;

    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ error: 'Missing required registration fields.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const firestore = admin.firestore();

    // Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(trimmedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }
    } catch (e: any) {
      // UserNotFound is expected
      if (e.code !== 'auth/user-not-found') {
        console.error('[RegisterCompany] Email check error:', e);
      }
    }

    // 1. Generate unique company ID and slug
    const cleanSlug = companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'company';
    const companyId = `company_${cleanSlug}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // 2. Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: trimmedEmail,
      password,
      displayName: adminName.trim(),
      emailVerified: true,
    });
    createdUid = userRecord.uid;

    // 3. Set Custom User Claims for multi-tenancy
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      companyId,
      companyName: companyName.trim(),
    });

    // 4. Batch/Transaction write in Firestore to guarantee atomicity
    const batch = firestore.batch();

    // Company document
    const companyRef = firestore.collection('companies').doc(companyId);
    batch.set(companyRef, {
      id: companyId,
      name: companyName.trim(),
      slug: cleanSlug,
      ownerUid: userRecord.uid,
      adminEmail: trimmedEmail,
      adminName: adminName.trim(),
      status: 'ACTIVE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      state: state || 'Maharashtra',
      contactPhone: phone || '',
      createdAt: now,
      updatedAt: now,
    });

    // Company member document
    const memberRef = companyRef.collection('members').doc(userRecord.uid);
    batch.set(memberRef, {
      userId: userRecord.uid,
      companyId,
      role: 'admin',
      employeeId: 'ADMIN-01',
      displayName: adminName.trim(),
      email: trimmedEmail,
      active: true,
      joinedAt: now,
    });

    // Company settings document
    const settingsRef = companyRef.collection('settings').doc('general');
    batch.set(settingsRef, {
      companyId,
      businessName: companyName.trim(),
      businessAddress: '',
      city: '',
      state: state || 'Maharashtra',
      pincode: '',
      gstin: '',
      contactPhone: phone || '',
      contactEmail: trimmedEmail,
      defaultGstRate: 18,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      paymentTerms: 'Payment due upon receipt of invoice.',
      invoiceNotes: 'Thank you for your business.',
      selectedTemplateId: 'CORPORATE',
      hasGpinConfigured: false,
      hasNpinConfigured: false,
      createdAt: now,
      updatedAt: now,
    });

    // Global user profile document
    const userProfileRef = firestore.collection('users').doc(userRecord.uid);
    batch.set(userProfileRef, {
      uid: userRecord.uid,
      employeeId: 'ADMIN-01',
      displayName: adminName.trim(),
      email: trimmedEmail,
      role: 'admin',
      active: true,
      companyId,
      companyName: companyName.trim(),
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    const auditRef = companyRef.collection('activityLogs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      companyId,
      actorUid: userRecord.uid,
      actorName: adminName.trim(),
      actorRole: 'admin',
      action: 'COMPANY_CREATED',
      entityType: 'settings',
      entityId: companyId,
      description: `Company ${companyName.trim()} registered by ${adminName.trim()}`,
      metadata: { companyId, companyName: companyName.trim(), email: trimmedEmail },
      timestamp: now,
    });

    await batch.commit();

    return res.status(201).json({
      success: true,
      message: `Company ${companyName} registered successfully!`,
      company: {
        id: companyId,
        name: companyName.trim(),
        slug: cleanSlug,
      },
      user: {
        uid: userRecord.uid,
        email: trimmedEmail,
        displayName: adminName.trim(),
        role: 'admin',
        companyId,
      },
    });
  } catch (error: any) {
    console.error('[RegisterCompany] Error:', error);

    // Rollback Auth user if created but Firestore write failed
    if (createdUid) {
      try {
        await admin.auth().deleteUser(createdUid);
      } catch (deleteErr) {
        console.error('[RegisterCompany] Rollback failed:', deleteErr);
      }
    }

    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }
    return res.status(500).json({ error: error.message || 'Failed to register company.' });
  }
}
