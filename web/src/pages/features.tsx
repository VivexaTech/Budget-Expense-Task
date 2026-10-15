import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import {
  TrendingUp,
  Receipt,
  Users,
  CheckSquare,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  PieChart,
  ArrowRight,
} from 'lucide-react';

export default function FeaturesPage() {
  const featureList = [
    {
      title: 'Income Collection & Partial Payments',
      icon: TrendingUp,
      color: 'bg-emerald-100 text-emerald-600',
      description:
        'Track client receivables with stage-by-stage partial payments. Unreceived amounts never artificially inflate company cash balance.',
      bullets: [
        'Client-wise collection task status (Pending, Partially Paid, Completed)',
        'Atomic Firestore transactions ensure exact ledger sync',
        'Next promised due date reminders for remaining balances',
        'Comprehensive payment history per client & project',
      ],
    },
    {
      title: 'Self-Paid vs Company Fund Expenses',
      icon: Receipt,
      color: 'bg-blue-100 text-blue-600',
      description:
        'Smart expense source detection. Prevent company balance discrepancies with automated reimbursement workflows.',
      bullets: [
        'By Self: Employee paid with personal money (excluded from cash deductions)',
        'By Company Fund: Deducted immediately from available balance exactly once',
        'Admin reimbursement tracking and approval queues',
        'Receipt uploads and auditable expense categories',
      ],
    },
    {
      title: 'Deterministic Financial Task Allocation',
      icon: CheckSquare,
      color: 'bg-indigo-100 text-indigo-600',
      description:
        'Chronological priority engine allocates available company balance to vendor bills, rent, and payroll tasks automatically.',
      bullets: [
        'Tasks mark READY_TO_COMPLETE only when real funds exist',
        'Dynamic shortfall calculations (how much more cash needed)',
        'Admin-only execution with tamper-proof audit trails',
        'Deterministic sorting by due date and creation timestamp',
      ],
    },
    {
      title: '4 Professional GST & Non-GST Invoices',
      icon: FileText,
      color: 'bg-amber-100 text-amber-600',
      description:
        'Generate and download compliant PDF invoices with secure cryptographic authorization PIN verification.',
      bullets: [
        'Corporate, Minimal, Modern Blue, and Classic GST templates',
        'Intra-state (CGST + SGST) and Inter-state (IGST) tax formulas',
        'Company branding, signature box, and bank UPI details',
        'Fixed and percentage discount engine with odd-paise rounding',
      ],
    },
    {
      title: 'Client CRM & Assigned Business Ledgers',
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
      description:
        'Maintain all your client profiles, GSTINs, billing addresses, assigned account managers, and payment histories in one place.',
      bullets: [
        'Full state code auto-detection and GST verification',
        'Client-wise outstanding balances and lifetime revenue',
        'Employee ownership and role-based client assignments',
        'One-click WhatsApp and email invoicing integration',
      ],
    },
    {
      title: 'Android Home-Screen Widgets & Mobile App',
      icon: Smartphone,
      color: 'bg-rose-100 text-rose-600',
      description:
        'Deep-linked native Android widgets right on your home screen for rapid everyday financial logging on the go.',
      bullets: [
        'Add Income & Add Expense quick-action widgets',
        'Target Remaining live glanceable dashboard widget',
        'Admin Task Review launcher widget',
        'New Client creation widget',
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Head>
        <title>Features — CompanyBudget SaaS Platform</title>
      </Head>

      <Navbar />

      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">Capabilities</span>
          <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            Engineered for Flawless Financial Execution
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            A comprehensive suite of multi-tenant tools designed to automate financial accuracy, protect company cash reserves, and accelerate team productivity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {featureList.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div key={idx} className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{f.description}</p>
                  <ul className="mt-6 space-y-2.5">
                    {f.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all"
          >
            Start Using All Features
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
