import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarChart3, Download, Calendar, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportsPage() {
  const { user, companyId } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    async function loadReportData() {
      if (!companyId) return;
      try {
        setLoading(true);

        // Incomes
        let incSnap = await getDocs(
          query(collection(db, 'companies', companyId, 'incomeEntries'), where('monthKey', '==', selectedMonth))
        );
        if (incSnap.empty) {
          incSnap = await getDocs(
            query(collection(db, 'incomeEntries'), where('monthKey', '==', selectedMonth))
          );
        }
        const incList: any[] = [];
        incSnap.forEach((d) => incList.push({ id: d.id, ...d.data() }));
        setIncomes(incList);

        // Expenses for Selected Month
        let expSnap = await getDocs(
          query(collection(db, 'companies', companyId, 'expenseEntries'), where('monthKey', '==', selectedMonth))
        );
        if (expSnap.empty) {
          expSnap = await getDocs(
            query(collection(db, 'expenseEntries'), where('monthKey', '==', selectedMonth))
          );
        }
        const expList: any[] = [];
        expSnap.forEach((d) => {
          const data = d.data();
          if ((data.companyId || 'company_vivexa') === companyId) {
            expList.push({ id: d.id, ...data });
          }
        });
        setExpenses(expList);

        // Audit Logs
        let auditSnap = await getDocs(collection(db, 'companies', companyId, 'activityLogs'));
        if (auditSnap.empty) auditSnap = await getDocs(collection(db, 'activityLogs'));
        const aList: any[] = [];
        auditSnap.forEach((d) => aList.push({ id: d.id, ...d.data() }));
        aList.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setAuditLogs(aList.slice(0, 15));
      } catch (err) {
        console.error('[Reports] Error loading report:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, [companyId, selectedMonth]);

  const totalIncome = incomes
    .filter((i) => i.status === 'VALID' || !i.status)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const companyExpenses = expenses
    .filter((e) => e.paymentSource === 'COMPANY_FUND' && e.approvalStatus !== 'REJECTED')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const selfPaidExpenses = expenses
    .filter((e) => e.paymentSource === 'SELF_PAID' && (e.reimbursementStatus === 'PAID' || e.reimbursementStatus === 'REIMBURSED'))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const netCashFlow = totalIncome - (companyExpenses + selfPaidExpenses);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Description / Client', 'Category / Mode', 'Amount (INR)', 'Payment Source'],
      ...incomes.map((i) => [
        i.createdAt?.slice(0, 10) || '',
        'INCOME',
        `"${(i.collectedFrom || '').replace(/"/g, '""')}"`,
        i.paymentMode || '',
        i.amount,
        'CLIENT_COLLECTION',
      ]),
      ...expenses.map((e) => [
        e.date || '',
        'EXPENSE',
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.category || '',
        e.amount,
        e.paymentSource || 'COMPANY_FUND',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Financial_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <Head>
        <title>Reports &amp; Analytics — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports &amp; Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monthly cash flow reconciliation, exportable CSV statements, and system logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold uppercase">Total Income</span>
          <p className="text-2xl font-bold text-emerald-600 mt-2">₹{totalIncome.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-500">Collected in {selectedMonth}</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold uppercase">Company Cash Outflows</span>
          <p className="text-2xl font-bold text-slate-900 mt-2">₹{companyExpenses.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-amber-600">Company Fund Deductions</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold uppercase">Self-Paid Expenses</span>
          <p className="text-2xl font-bold text-blue-600 mt-2">₹{selfPaidExpenses.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-500">Employee-Funded (No cash drop)</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold uppercase">Net Operating Cash Flow</span>
          <p className={`text-2xl font-bold mt-2 ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {netCashFlow >= 0 ? '+' : ''}₹{netCashFlow.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500">Income minus company expenses</span>
        </div>
      </div>

      {/* Audit Logs Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Recent Activity &amp; Audit Logs (Tenant Scoped)
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No audit records recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-800">{log.description || log.action}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Actor: <span className="text-slate-700 font-medium">{log.actorName || log.actorUid}</span> ({log.actorRole || 'system'})
                  </p>
                </div>
                <span className="font-mono text-slate-400 text-[10px] shrink-0">
                  {log.timestamp ? format(new Date(log.timestamp), 'dd MMM, HH:mm') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
