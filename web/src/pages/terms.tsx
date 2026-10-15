import React from 'react';
import Head from 'next/head';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Head>
        <title>Terms of Service — CompanyBudget</title>
      </Head>

      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-extrabold text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-xs text-slate-500">Effective Date: October 2026</p>

        <div className="mt-8 prose prose-slate text-sm text-slate-600 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-slate-800">1. Acceptance of Terms</h2>
            <p>
              By creating a workspace or accessing the CompanyBudget platform, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">2. Workspace Administration</h2>
            <p>
              Administrators are responsible for provisioning employee accounts, managing role permissions, and maintaining accurate billing and GST details for their respective organization.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800">3. Financial Integrity &amp; Compliance</h2>
            <p>
              CompanyBudget provides deterministic calculations and invoice generation tools. Organizations remain solely responsible for tax reporting and statutory GST compliance under local laws.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
