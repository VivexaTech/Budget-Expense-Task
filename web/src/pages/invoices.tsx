import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Invoice, Client, IncomeTask, InvoiceTemplateId } from '../types';
import { FileText, Plus, Search, Eye, Printer, Download, X, KeyRound, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function InvoicesPage() {
  const { user, companyId } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [incomeTasks, setIncomeTasks] = useState<IncomeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'GST' | 'NON_GST'>('ALL');

  // Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Generate Modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'GST' | 'NON_GST'>('GST');
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');

  const loadInvoicesAndData = async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      // Invoices
      let snap = await getDocs(collection(db, 'companies', companyId, 'invoices'));
      if (snap.empty) snap = await getDocs(collection(db, 'invoices'));
      const list: Invoice[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Invoice));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setInvoices(list);

      // Clients
      let cSnap = await getDocs(collection(db, 'companies', companyId, 'clients'));
      if (cSnap.empty) cSnap = await getDocs(collection(db, 'clients'));
      const cList: Client[] = [];
      cSnap.forEach((d) => cList.push({ id: d.id, ...d.data() } as Client));
      setClients(cList);

      // Income Tasks
      let tSnap = await getDocs(collection(db, 'companies', companyId, 'incomeTasks'));
      if (tSnap.empty) tSnap = await getDocs(collection(db, 'incomeTasks'));
      const tList: IncomeTask[] = [];
      tSnap.forEach((d) => tList.push({ id: d.id, ...d.data() } as IncomeTask));
      setIncomeTasks(tList);
    } catch (err) {
      console.error('[Invoices] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoicesAndData();
  }, [companyId]);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !pin) {
      alert('Please select a collection task and enter your authorization PIN.');
      return;
    }
    setGenerating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const token = await user?.uid; // or Firebase Auth token
      const res = await fetch(`${apiUrl}/api/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: selectedTaskId,
          type: invoiceType,
          pin: pin.trim(),
          companyId,
          notes: notes.trim(),
          requestingUserUid: user?.uid,
          requestingUserName: user?.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate invoice.');
      }

      setShowGenModal(false);
      setPin('');
      setNotes('');
      loadInvoicesAndData();
      alert(`Invoice ${data.invoice?.invoiceNumber || ''} issued successfully!`);
    } catch (err: any) {
      console.error('[Invoices] Gen error:', err);
      alert(err.message || 'Error issuing invoice.');
    } finally {
      setGenerating(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'ALL' || inv.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <AppLayout>
      <Head>
        <title>Invoices &amp; Billing — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices &amp; Billing</h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate tax-compliant GST &amp; Non-GST invoices with PIN security
          </p>
        </div>

        <button
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Generate Invoice
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, client name..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
          >
            <option value="ALL">All Invoices</option>
            <option value="GST">GST Invoices</option>
            <option value="NON_GST">Non-GST Invoices</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No invoices found. Click "Generate Invoice" to issue a new bill.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">Tax</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{inv.createdAt.slice(0, 10)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inv.clientName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.type === 'GST'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ₹{Number(inv.taxableAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ₹{Number(inv.totalTax).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{Number(inv.finalTotalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setPreviewInvoice(inv)}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors"
                        title="View & Print"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Print / Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {previewInvoice.invoiceNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
                <button onClick={() => setPreviewInvoice(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rendered Invoice Sheet */}
            <div className="mt-6 p-6 border border-slate-200 rounded-xl bg-white text-slate-900 print:border-none print:p-0">
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{previewInvoice.companyName}</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">{previewInvoice.companyAddress || 'Corporate Office'}</p>
                  {previewInvoice.companyGstin && (
                    <p className="text-xs font-mono text-slate-600 mt-1">GSTIN: {previewInvoice.companyGstin}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-blue-600 tracking-wider">
                    {previewInvoice.type === 'GST' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800 mt-1">{previewInvoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">Date: {previewInvoice.createdAt.slice(0, 10)}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="my-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billed To</p>
                <h4 className="text-sm font-bold text-slate-900 mt-1">{previewInvoice.clientName}</h4>
                {previewInvoice.clientAddress && <p className="text-xs text-slate-600">{previewInvoice.clientAddress}</p>}
                {previewInvoice.clientGstin && (
                  <p className="text-xs font-mono text-slate-600 mt-1">GSTIN: {previewInvoice.clientGstin}</p>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-xs text-left border-collapse my-6">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 font-bold text-slate-600">
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-3 font-medium">{previewInvoice.description || 'Professional Services'}</td>
                    <td className="py-3 px-3 text-right">1</td>
                    <td className="py-3 px-3 text-right">₹{Number(previewInvoice.originalAmount).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-bold">₹{Number(previewInvoice.originalAmount).toLocaleString('en-IN')}</td>
                  </tr>
                  {previewInvoice.discountAmount > 0 && (
                    <tr className="text-red-600">
                      <td className="py-2 px-3">Discount</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right font-bold">-₹{Number(previewInvoice.discountAmount).toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Tax Summary */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>₹{Number(previewInvoice.taxableAmount).toLocaleString('en-IN')}</span>
                  </div>
                  {previewInvoice.cgstAmount > 0 && (
                    <div className="flex justify-between">
                      <span>CGST (9%):</span>
                      <span>₹{Number(previewInvoice.cgstAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {previewInvoice.sgstAmount > 0 && (
                    <div className="flex justify-between">
                      <span>SGST (9%):</span>
                      <span>₹{Number(previewInvoice.sgstAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {previewInvoice.igstAmount > 0 && (
                    <div className="flex justify-between">
                      <span>IGST (18%):</span>
                      <span>₹{Number(previewInvoice.igstAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-blue-600">₹{Number(previewInvoice.finalTotalAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Generate New Invoice</h3>
              <button onClick={() => setShowGenModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Collection Task *</label>
                <select
                  required
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Choose task to bill --</option>
                  {incomeTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.clientName} — {t.projectName} (₹{t.expectedAmount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  6-Digit Invoice Authorization PIN *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your secure 6-digit authorization PIN to verify and lock this invoice.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Remarks / Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Milestone 1 completion"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {generating ? 'Verifying PIN & Generating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
