import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, doc, setDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { IncomeEntry, PaymentMode } from '../types';
import { TrendingUp, Plus, Search, Filter, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';

export default function IncomesPage() {
  const { user, companyId } = useAuth();
  const currentMonth = format(new Date(), 'yyyy-MM');

  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [collectedFrom, setCollectedFrom] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [notes, setNotes] = useState('');

  const loadIncomes = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      let snap = await getDocs(
        query(
          collection(db, 'companies', companyId, 'incomeEntries'),
          where('monthKey', '==', selectedMonth)
        )
      );
      if (snap.empty) {
        snap = await getDocs(
          query(
            collection(db, 'incomeEntries'),
            where('monthKey', '==', selectedMonth)
          )
        );
      }
      const list: IncomeEntry[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IncomeEntry));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setIncomes(list);
    } catch (err) {
      console.error('[Incomes] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncomes();
  }, [companyId, selectedMonth]);

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'incomeEntries'));
      const now = new Date().toISOString();

      const newEntry: IncomeEntry = {
        id: newRef.id,
        companyId,
        employeeId: user.employeeId || 'EMP-ADMIN',
        employeeUid: user.uid,
        employeeNameSnapshot: user.displayName,
        amount: Number(amount),
        collectedFrom: collectedFrom.trim(),
        workDescription: workDescription.trim(),
        paymentMode,
        monthKey: selectedMonth,
        notes: notes.trim(),
        createdAt: now,
        status: 'VALID',
      };

      // Write to company subcollection and root
      await setDoc(doc(db, 'companies', companyId, 'incomeEntries', newRef.id), newEntry);
      await setDoc(newRef, newEntry);

      setShowModal(false);
      setAmount('');
      setCollectedFrom('');
      setWorkDescription('');
      setNotes('');
      loadIncomes();
    } catch (err: any) {
      console.error('[Incomes] Add error:', err);
      alert('Failed to save income: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIncomes = incomes.filter(
    (i) =>
      i.collectedFrom.toLowerCase().includes(search.toLowerCase()) ||
      i.workDescription.toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = filteredIncomes.reduce(
    (sum, i) => (i.status === 'VALID' ? sum + Number(i.amount) : sum),
    0
  );

  return (
    <AppLayout>
      <Head>
        <title>Income Tracking — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Income Tracking</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track client collections, advance payments, and bank receipts for {selectedMonth}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Record New Income
        </button>
      </div>

      {/* Filter & Metric Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client or description..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Month Picker */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-slate-500 font-medium">Month Total:</span>
          <span className="text-lg font-bold text-emerald-600">
            ₹{totalCollected.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Incomes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading incomes...</div>
        ) : filteredIncomes.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No income entries found for this period. Click "Record New Income" to log one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Client / Source</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncomes.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {format(new Date(entry.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{entry.collectedFrom}</td>
                    <td className="py-3 px-4 text-slate-600">{entry.workDescription || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {entry.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{entry.employeeNameSnapshot}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      ₹{Number(entry.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          entry.status === 'VALID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Income Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Income Entry</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddIncome} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 50000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client / Payer Name *
                </label>
                <input
                  type="text"
                  required
                  value={collectedFrom}
                  onChange={(e) => setCollectedFrom(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. ABC Solutions Pvt Ltd"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Description / Service *
                </label>
                <input
                  type="text"
                  required
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Website Maintenance Advance"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="UPI">UPI / QR</option>
                    <option value="BANK_TRANSFER">Bank NEFT/IMPS</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Transaction ref, invoice #, etc."
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Income Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
