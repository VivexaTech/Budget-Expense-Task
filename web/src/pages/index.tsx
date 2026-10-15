import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import {
  Building2,
  TrendingUp,
  Receipt,
  CheckCircle2,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  BarChart,
  Users,
  ChevronDown,
  DollarSign,
  Smartphone,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does multi-company workspace isolation work?',
      a: 'Every registered company receives an isolated subcollection namespace (e.g., /companies/{companyId}/...). All database queries, financial counters, audit logs, and push notifications are strictly scoped by the tenant identifier. Even in shared databases, cross-tenant data leakage is mathematically blocked by custom claims and Firestore security rules.',
    },
    {
      q: 'What is the difference between "By Self" and "By Company Fund" expenses?',
      a: 'When an employee pays out of their own pocket, the expense is recorded as "By Self (Employee Paid)" and does NOT deduct from the company cash balance until reimbursed. When paid using company funds, it is immediately deducted from the company available balance and tracked on the balance ledger.',
    },
    {
      q: 'Can our company customize GST invoice layouts?',
      a: 'Yes. CompanyBudget includes 4 distinct professional templates: Professional Corporate, Ultra Minimal, Modern Blue, and Classic GST (with HSN/SAC breakdowns). You can configure your company logo, GSTIN, payment terms, and bank details.',
    },
    {
      q: 'Do you offer mobile applications and home-screen widgets?',
      a: 'Yes! We offer a full React Native Expo Android app equipped with 5 native home-screen widgets: Add Income, Add Client, Add Expense, Complete Task (Admin Only), and Target Remaining.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Head>
        <title>CompanyBudget — Enterprise Multi-Company SaaS Platform</title>
      </Head>

      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-slate-50 to-slate-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Multi-Tenant SaaS Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Financial Management &amp; Task-Funded Budgeting for{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Growing Enterprises
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Eliminate chaotic spreadsheets. Manage multiple isolated company workspaces, deterministic task allocation, self-paid vs company expenses, client ledgers, and 4 customizable GST invoices.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
            >
              Register New Organization
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all"
            >
              Sign In to Workspace
            </Link>
          </div>

          {/* Social Proof Bar */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Multi-Tenant Data Isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span>Deterministic Task Allocation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              <span>Android Widgets &amp; Mobile App</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>4 Customizable GST Templates</span>
            </div>
          </div>
        </div>

        {/* Interactive Dashboard Preview Mockup */}
        <div className="mt-14 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-2xl p-2 bg-gradient-to-b from-slate-200 to-slate-300 shadow-2xl">
            <div className="rounded-xl overflow-hidden bg-white border border-slate-200">
              {/* App Window Header */}
              <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="text-xs font-mono text-slate-500">
                  companybudget.app/dashboard • Google LLC Workspace
                </div>
                <div className="w-12" />
              </div>

              {/* Inner Dashboard Mock */}
              <div className="p-6 sm:p-8 bg-slate-50">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">AVAILABLE BALANCE</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">₹13,00,000</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">100% Cash Ready</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">MONTHLY TARGET</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">₹15,00,000</p>
                    <span className="text-[10px] text-blue-600 font-semibold">86.6% Achieved</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">COLLECTED INCOME</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">₹13,00,000</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">Valid Receipts</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">TARGET REMAINING</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">₹2,00,000</p>
                    <span className="text-[10px] text-amber-600 font-semibold">To Breakeven Target</span>
                  </div>
                </div>

                {/* Task Readiness Bar */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-800">Deterministic Task Allocation Pass</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                      ₹10,00,000 Surplus Unallocated
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full w-2/3" title="Ready to Complete"></div>
                    <div className="bg-amber-400 h-full w-1/6" title="Pending Allocation"></div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Task 1 (Cloud Infrastructure - ₹3,00,000): <strong className="text-emerald-700">READY TO COMPLETE</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase">Built for Scale</h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Everything Your Finance &amp; Operations Team Needs
            </p>
            <p className="mt-4 text-base text-slate-600">
              One unified platform for company budgets, client collections, expense approvals, and GST invoicing.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Multi-Company Tenancy</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Run Google, HCL, Vivexa Technologies, or new branches in completely isolated workspaces. Zero cross-company leakage.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Self vs Company Expenses</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Track whether an employee paid personally or with company funds. Deduct from company balance only when company money is used.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Deterministic Task Allocation</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Automated chronological fund allocation. Tasks turn READY_TO_COMPLETE only when real company cash is available.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">4 GST Invoice Templates</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Corporate, Minimal, Modern Blue, and Classic GST. Complete with CGST, SGST, IGST, HSN, and cryptographic authorization PIN security.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Android Home-Screen Widgets</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Quick actions right from your Android device: Add Income, Add Client, Add Expense, Complete Task, and Target Remaining.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Audit Logs &amp; Security</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Immutable activity logs for every financial disbursement, task completion, invoice creation, and partial payment receipt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-blue-600 tracking-wider uppercase">Transparent Plans</h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Simple, Predictable Pricing for Any Business
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Starter</h3>
                <p className="mt-1 text-sm text-slate-500">For small teams getting started</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">₹999</span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 5 Employees</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Income &amp; Expense Tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Basic Invoice Generation</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Android Mobile App</li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 w-full text-center py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-all">
                Get Started
              </Link>
            </div>

            {/* Growth / Pro */}
            <div className="p-8 rounded-2xl bg-white border-2 border-blue-600 shadow-xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Growth Pro</h3>
                <p className="mt-1 text-sm text-slate-500">For scaling businesses &amp; agencies</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">₹2,499</span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> Up to 25 Employees</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> Deterministic Task Readiness</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> All 4 Invoice Templates</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> Android Home-Screen Widgets</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600" /> Audit Logs &amp; CSV Exports</li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 w-full text-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Enterprise</h3>
                <p className="mt-1 text-sm text-slate-500">For organizations with multiple entities</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">Custom</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited Employees &amp; Workspaces</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dedicated Firebase Partitioning</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Custom ERP / Accounting Sync</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> SLA &amp; 24/7 Dedicated Support</li>
                </ul>
              </div>
              <Link href="/contact" className="mt-8 w-full text-center py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-all">
                Contact Enterprise
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex justify-between items-center bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 text-sm text-slate-600 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-14 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Ready to upgrade your company's financial operations?
          </h2>
          <p className="mt-3 text-base text-blue-100 max-w-xl mx-auto">
            Set up your organization workspace in 60 seconds with full multi-tenant isolation.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/register"
              className="px-6 py-3.5 bg-white text-blue-700 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-all hover:scale-105"
            >
              Create Your Company Account Now
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
