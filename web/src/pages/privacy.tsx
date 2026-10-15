import React from 'react';
import Head from 'next/head';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Head>
        <title>Privacy Policy — CompanyBudget</title>
      </Head>

      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-extrabold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-xs text-slate-500">Last updated: October 2026</p>

        <div className="mt-8 prose prose-slate text-sm text-slate-600 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-slate-800">1. Data Isolation &amp; Tenant Ownership</h2>
            <p>
              CompanyBudget guarantees that each tenant’s financial entries, invoice settings, employee records, and client databases are stored in dedicated Firestore subcollections. We do not sell, rent, or cross-reference your organization’s proprietary data with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">2. Information We Collect</h2>
            <p>
              We collect information provided during registration (company name, administrator contact details, GSTIN) and records logged in the system (client profiles, income collection tasks, expense items, invoice history).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">3. Cryptographic Protection of Secrets</h2>
            <p>
              Sensitive invoice authorization credentials and security PINs are never stored in plaintext. They are cryptographically hashed using HMAC-SHA256 with unique salting on secure serverless infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">4. Contact Information</h2>
            <p>
              If you have any questions or data deletion requests, contact privacy@vivexatech.in.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
