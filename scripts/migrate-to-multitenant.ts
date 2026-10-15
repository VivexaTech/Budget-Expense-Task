import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback to default credentials or environment variable
    admin.initializeApp();
  }
}

const firestore = admin.firestore();

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

export async function runMultiTenantMigration(targetCompanyId = 'company_vivexa', companyName = 'Vivexa Technologies'): Promise<MigrationStats[]> {
  console.log(`\n======================================================`);
  console.log(`Starting Multi-Tenant Migration to [${targetCompanyId}] (${companyName})`);
  console.log(`======================================================\n`);

  const results: MigrationStats[] = [];
  const now = new Date().toISOString();

  // 1. Ensure Root Company Document Exists
  const companyRef = firestore.collection('companies').doc(targetCompanyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    console.log(`Creating default company profile: ${targetCompanyId}...`);
    await companyRef.set({
      id: targetCompanyId,
      name: companyName,
      slug: 'vivexa',
      ownerUid: 'system_admin',
      adminEmail: 'admin@vivexatech.com',
      adminName: 'Vivexa Administrator',
      status: 'ACTIVE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      createdAt: now,
      updatedAt: now,
    });
  } else {
    console.log(`Company profile [${targetCompanyId}] already exists.`);
  }

  // 2. Migrate Invoice Settings to companies/{companyId}/settings/general
  const generalSettingsRef = companyRef.collection('settings').doc('general');
  const genSettingsSnap = await generalSettingsRef.get();
  if (!genSettingsSnap.exists) {
    const legacySettings = await firestore.collection('systemConfig').doc('invoiceSettings').get();
    if (legacySettings.exists) {
      console.log(`Migrating invoice settings to companies/${targetCompanyId}/settings/general...`);
      await generalSettingsRef.set({
        ...legacySettings.data(),
        companyId: targetCompanyId,
        updatedAt: now,
      });
    } else {
      console.log(`Initializing default settings for ${targetCompanyId}...`);
      await generalSettingsRef.set({
        companyId: targetCompanyId,
        businessName: companyName,
        businessAddress: 'Corporate Towers, Tech Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '',
        contactPhone: '',
        contactEmail: 'contact@vivexatech.com',
        defaultGstRate: 18,
        paymentTerms: 'Payment due upon receipt.',
        invoiceNotes: 'Thank you for your business.',
        selectedTemplateId: 'CORPORATE',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Collections to migrate into company subcollections
  const collectionsToMigrate = [
    'users',
    'budgets',
    'tasks',
    'recurringTaskTemplates',
    'incomeEntries',
    'expenseEntries',
    'expenseGroups',
    'clients',
    'incomeTasks',
    'invoices',
    'invoiceCounters',
    'activityLogs',
    'notificationEvents',
  ];

  for (const collName of collectionsToMigrate) {
    const stats: MigrationStats = {
      collection: collName,
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const snap = await firestore.collection(collName).get();
      stats.total = snap.size;

      if (snap.empty) {
        console.log(`[${collName}] No documents found. Skipping.`);
        results.push(stats);
        continue;
      }

      console.log(`[${collName}] Migrating ${stats.total} documents...`);

      // Batch in chunks of 400 (Firestore limit is 500)
      const batchSize = 400;
      let currentBatch = firestore.batch();
      let opCount = 0;

      for (const doc of snap.docs) {
        try {
          const docData = doc.data();
          const targetSubcollection = collName === 'users' ? 'members' : collName;
          const targetDocRef = companyRef.collection(targetSubcollection).doc(doc.id);
          const targetSnap = await targetDocRef.get();

          if (!targetSnap.exists) {
            const migratedPayload = {
              ...docData,
              companyId: targetCompanyId,
              migratedAt: now,
            };
            currentBatch.set(targetDocRef, migratedPayload);
            stats.migrated++;
            opCount++;
          } else {
            stats.skipped++;
          }

          // If it's a user profile, also ensure the root user profile has companyId set
          if (collName === 'users' && !docData.companyId) {
            currentBatch.update(doc.ref, {
              companyId: targetCompanyId,
              companyName,
              updatedAt: now,
            });
            opCount++;
          }

          if (opCount >= batchSize) {
            await currentBatch.commit();
            currentBatch = firestore.batch();
            opCount = 0;
          }
        } catch (err: any) {
          console.error(`Error processing doc ${doc.id} in ${collName}:`, err.message);
          stats.errors++;
        }
      }

      if (opCount > 0) {
        await currentBatch.commit();
      }

      console.log(`[${collName}] Complete: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors.`);
    } catch (err: any) {
      console.error(`Error migrating collection ${collName}:`, err.message);
      stats.errors++;
    }

    results.push(stats);
  }

  console.log(`\n======================================================`);
  console.log(`Migration Complete Summary:`);
  console.table(results);
  console.log(`======================================================\n`);

  return results;
}

// Allow direct execution from CLI
if (require.main === module) {
  runMultiTenantMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
