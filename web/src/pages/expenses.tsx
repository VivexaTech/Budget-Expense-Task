import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExpenseEntry, PaymentSource } from '../types';
import { Receipt, Plus, Search, Filter, X, CreditCard, User, Building } from 'lucide-react';
import { format } from 'date-fns';

export default function ExpensesPage() {
  const { user, companyId } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<'ALL' | 'COMPANY_FUND' | 'SELF_PAID'>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Office Supplies');
  const [description, setDescription] = useState('');
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('COMPANY_FUND');

  const loadExpenses = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      let snap = await getDocs(collection(db, 'companies', companyId, 'expenseEntries'));
      if (snap.empty) {
        snap = await getDocs(collection(db, 'expenseEntries'));
      }
      const list: ExpenseEntry[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ExpenseEntry));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setExpenses(list);
    } catch (err) {
      console.error('[Expenses] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [companyId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'expenseEntries'));
      const now = new Date().toISOString();

      const newExpense: ExpenseEntry = {
        id: newRef.id,
        companyId,
        employeeId: user.employeeId || 'EMP-ADMIN',
        employeeUid: user.uid,
        employeeNameSnapshot: user.displayName,
        groupId: 'general',
        amount: Number(amount),
        category,
        description: description.trim(),
        paymentSource,
        reimbursementStatus: paymentSource === 'SELF_PAID' ? 'PENDING' : 'NOT_APPLICABLE',
        status: 'APPROVED',
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: now,
      };

      // Dual write
      await setDoc(doc(db, 'companies', companyId, 'expenseEntries', newRef.id), newExpense);
      await setDoc(newRef, newExpense);

      setShowModal(false);
      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      console.error('[Expenses] Add error:', err);
      alert('Failed to save expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeNameSnapshot.toLowerCase().includes(search.toLowerCase());
    const matchSource = filterSource === 'ALL' || e.paymentSource === filterSource;
    return matchSearch && matchSource;
  });

  const companyFundTotal = expenses
    .filter((e) => e.paymentSource === 'COMPANY_FUND')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const selfPaidTotal = expenses
    .filter((e) => e.paymentSource === 'SELF_PAID')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <AppLayout>
      <Head>
        <title>Expense Management — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage company fund deductions and track employee self-paid reimbursements
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Log New Expense
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase">Company Fund Expenses</span>
            <p className="text-xl font-bold text-slate-900 mt-1">₹{companyFundTotal.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-amber-600">Deducted from available company cash</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase">Self-Paid Expenses</span>
            <p className="text-xl font-bold text-slate-900 mt-1">₹{selfPaidTotal.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-blue-600">Paid by employees • Reimbursement track</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, employee, category..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Source:</span>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
          >
            <option value="ALL">All Payment Sources</option>
            <option value="COMPANY_FUND">By Company Fund</option>
            <option value="SELF_PAID">By Self (Employee Paid)</option>
          </select>
        </div>
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No expense records found. Click "Log New Expense" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4">Payment Source</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{exp.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{exp.category}</td>
                    <td className="py-3 px-4 text-slate-600">{exp.description}</td>
                    <td className="py-3 px-4 text-slate-500">{exp.employeeNameSnapshot}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          exp.paymentSource === 'COMPANY_FUND'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {exp.paymentSource === 'COMPANY_FUND' ? 'Company Fund' : 'By Self (Employee)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        {exp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Log New Expense</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Source *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentSource('COMPANY_FUND')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      paymentSource === 'COMPANY_FUND'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Building className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">By Company Fund</p>
                      <p className="text-[10px] text-slate-500">Deduct from company cash</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentSource('SELF_PAID')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      paymentSource === 'SELF_PAID'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <User className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">By Self (Employee)</p>
                      <p className="text-[10px] text-slate-500">Personal money / reimburse</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 3500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Office Supplies">Office Supplies &amp; Consumables</option>
                  <option value="Travel & Commute">Travel &amp; Fuel</option>
                  <option value="Client Meeting">Client Entertainment &amp; Meals</option>
                  <option value="Hardware / IT">Hardware &amp; Repairs</option>
                  <option value="Software / SaaS">Software &amp; Subscriptions</option>
                  <option value="Rent & Utilities">Rent &amp; Utilities</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Printer cartridges & paper ream"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
