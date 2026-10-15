import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Building2, Shield, Award, Users, CheckCircle } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Head>
        <title>About Us — CompanyBudget SaaS Platform</title>
      </Head>

      <Navbar />

      <section className="py-16 md:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">Our Mission</span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
            Empowering Companies with Crystal-Clear Financial Truth
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            CompanyBudget was built to solve a critical problem that founders, operations leaders, and finance teams face every day: managing cash flow, vendor commitments, client collections, and employee disbursements with zero ambiguity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Data Isolation First</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Every company operates in its own encrypted subcollection boundary. Your numbers and audit trails belong strictly to your company.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Zero Over-Allocation</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              We believe financial commitments should only turn actionable when real liquid funds have been collected and verified.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Employee Collaboration</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Empower team members to record collections and expenses without risking administrator control or company cash leaks.
            </p>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Architecture &amp; Reliability</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Built on Google Cloud Firebase Firestore, Vercel Serverless Functions, Next.js, and React Native Expo, CompanyBudget delivers sub-second sync across web dashboards and mobile devices.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Multi-Tenant Firestore Subcollection Architecture</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Atomic 2-Phase Firestore Transactions</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Cryptographic HMAC-SHA256 Authorization PINs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Native Android Home-Screen Widgets Integration</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
