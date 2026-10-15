import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { computeFinancialOverview } from '../lib/financialCalculations';
import {
  TrendingUp,
  Receipt,
  Users,
  CheckSquare,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Wallet,
  Target,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user, company, companyId } = useAuth();
  const currentMonthKey = format(new Date(), 'yyyy-MM');

  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [monthlyTarget, setMonthlyTarget] = useState(100000);
  const [validIncome, setValidIncome] = useState(0);
  const [companyExpenses, setCompanyExpenses] = useState(0);
  const [completedTasksTotal, setCompletedTasksTotal] = useState(0);
  const [readyTasksCount, setReadyTasksCount] = useState(0);
  const [recentIncomes, setRecentIncomes] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

  useEffect(() => {
    async function loadFinancials() {
      try {
        setLoading(true);

        // 1. Fetch Incomes for Current Month
        let incomesSnap = await getDocs(
          query(collection(db, 'companies', companyId, 'incomeEntries'), where('monthKey', '==', currentMonthKey))
        );
        if (incomesSnap.empty) {
          incomesSnap = await getDocs(
            query(collection(db, 'incomeEntries'), where('monthKey', '==', currentMonthKey))
          );
        }
        const incList: any[] = [];
        incomesSnap.forEach((d) => {
          const data = d.data();
          if ((data.companyId || 'company_vivexa') === companyId) {
            incList.push({ id: d.id, ...data });
          }
        });

        // 2. Fetch Expenses for Current Month
        let expensesSnap = await getDocs(
          query(collection(db, 'companies', companyId, 'expenseEntries'), where('monthKey', '==', currentMonthKey))
        );
        if (expensesSnap.empty) {
          expensesSnap = await getDocs(
            query(collection(db, 'expenseEntries'), where('monthKey', '==', currentMonthKey))
          );
        }
        const expList: any[] = [];
        expensesSnap.forEach((d) => {
          const data = d.data();
          if ((data.companyId || 'company_vivexa') === companyId) {
            expList.push({ id: d.id, ...data });
          }
        });

        // 3. Fetch Tasks for Current Month
        let tasksSnap = await getDocs(
          query(collection(db, 'companies', companyId, 'tasks'), where('monthKey', '==', currentMonthKey))
        );
        if (tasksSnap.empty) {
          tasksSnap = await getDocs(
            query(collection(db, 'tasks'), where('monthKey', '==', currentMonthKey))
          );
        }
        const taskList: any[] = [];
        let readyCount = 0;
        tasksSnap.forEach((d) => {
          const data = d.data();
          if ((data.companyId || 'company_vivexa') === companyId) {
            taskList.push({ id: d.id, ...data });
            if (data.status === 'READY_TO_COMPLETE') {
              readyCount++;
            }
          }
        });
        setReadyTasksCount(readyCount);

        // 4. Fetch Budget Config
        let budgetSnap = await getDoc(doc(db, 'companies', companyId, 'budgets', currentMonthKey));
        let budgetData: any = null;
        if (budgetSnap.exists()) {
          budgetData = budgetSnap.data();
        } else {
          const rootBudgetSnap = await getDoc(doc(db, 'budgets', currentMonthKey));
          if (rootBudgetSnap.exists()) {
            budgetData = rootBudgetSnap.data();
          }
        }

        // 5. Authoritative calculation using unified financial engine
        const overview = computeFinancialOverview({
          budget: budgetData,
          tasks: taskList,
          incomeEntries: incList,
          expenseEntries: expList,
          companyId,
          monthKey: currentMonthKey,
        });

        setOpeningBalance(overview.openingBalance);
        setMonthlyTarget(overview.monthlyTarget);
        setValidIncome(overview.incomeCollected);
        setCompanyExpenses(overview.paidExpensesAmount);
        setCompletedTasksTotal(overview.completedTasksAmount);
        setRecentIncomes(incList.slice(0, 5));
        setRecentExpenses(expList.slice(0, 5));
      } catch (err) {
        console.error('[Dashboard] Error loading financials:', err);
      } finally {
        setLoading(false);
      }
    }

    if (companyId) {
      loadFinancials();
    }
  }, [companyId, currentMonthKey]);

  const availableBalance = openingBalance + validIncome - completedTasksTotal - companyExpenses;
  const targetRemaining = Math.max(0, monthlyTarget - validIncome);
  const targetPercent = Math.min(100, Math.round((validIncome / (monthlyTarget || 1)) * 100));

  const formatCurrency = (val: number) => {
    return '₹' + Number(val).toLocaleString('en-IN');
  };

  return (
    <AppLayout>
      <Head>
        <title>Dashboard — CompanyBudget</title>
      </Head>

      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Month: <span className="font-semibold text-slate-700">{format(new Date(), 'MMMM yyyy')}</span> • Company: <span className="font-semibold text-blue-600">{company?.name || user?.companyName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/incomes"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Income
          </Link>
          <Link
            href="/expenses"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* Ready Tasks Alert Banner if any */}
      {readyTasksCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-900">
                {readyTasksCount} Task{readyTasksCount > 1 ? 's' : ''} Ready to Complete
              </h3>
              <p className="text-xs text-blue-700">
                Sufficient company balance is available to review and finalize disbursement.
              </p>
            </div>
          </div>
          <Link
            href="/tasks"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm shrink-0"
          >
            Review Tasks
          </Link>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Available Balance */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Balance</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(availableBalance)}</p>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Real Liquid Company Cash
          </p>
        </div>

        {/* Monthly Target */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Target</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(monthlyTarget)}</p>
          <p className="text-[11px] text-blue-600 font-semibold mt-1">
            {targetPercent}% Target Reached
          </p>
        </div>

        {/* Total Collected */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Income</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{formatCurrency(validIncome)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Current Month Collections
          </p>
        </div>

        {/* Target Remaining */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Remaining</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{formatCurrency(targetRemaining)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Needed to meet goal
          </p>
        </div>
      </div>

      {/* Monthly Target Progress Card */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Target Completion Progress</h2>
            <p className="text-xs text-slate-500">Collected {formatCurrency(validIncome)} of {formatCurrency(monthlyTarget)}</p>
          </div>
          <span className="text-sm font-extrabold text-blue-600">{targetPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${targetPercent}%` }}
          />
        </div>
      </div>

      {/* Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Incomes */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Recent Income Collections
            </h3>
            <Link href="/incomes" className="text-xs font-semibold text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          {recentIncomes.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No income records logged this month yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentIncomes.map((inc) => (
                <div key={inc.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{inc.collectedFrom}</p>
                    <p className="text-[11px] text-slate-500">{inc.workDescription || inc.paymentMode}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">+{formatCurrency(inc.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              Recent Expenses
            </h3>
            <Link href="/expenses" className="text-xs font-semibold text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No expenses logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{exp.category || exp.description}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      exp.paymentSource === 'COMPANY_FUND'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {exp.paymentSource === 'COMPANY_FUND' ? 'Company Fund' : 'By Self (Employee)'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">-{formatCurrency(exp.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
