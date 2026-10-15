import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { collection, query, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FinancialTask, FinancialTaskStatus } from '../types';
import { CheckSquare, Plus, CheckCircle2, Clock, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

export default function TasksPage() {
  const { user, companyId } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks] = useState<FinancialTask[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const loadTasksAndBalance = async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      // Incomes
      let incomesSnap = await getDocs(collection(db, 'companies', companyId, 'incomeEntries'));
      if (incomesSnap.empty) incomesSnap = await getDocs(collection(db, 'incomeEntries'));
      let incTotal = 0;
      incomesSnap.forEach((d) => {
        if (d.data().status !== 'VOIDED') incTotal += Number(d.data().amount || 0);
      });

      // Expenses
      let expSnap = await getDocs(collection(db, 'companies', companyId, 'expenseEntries'));
      if (expSnap.empty) expSnap = await getDocs(collection(db, 'expenseEntries'));
      let expTotal = 0;
      expSnap.forEach((d) => {
        const data = d.data();
        if (data.status === 'APPROVED' && (data.paymentSource === 'COMPANY_FUND' || data.reimbursementStatus === 'REIMBURSED')) {
          expTotal += Number(data.amount || 0);
        }
      });

      // Tasks
      let tasksSnap = await getDocs(collection(db, 'companies', companyId, 'tasks'));
      if (tasksSnap.empty) tasksSnap = await getDocs(collection(db, 'tasks'));
      const rawTasks: FinancialTask[] = [];
      let completedAmount = 0;

      tasksSnap.forEach((d) => {
        const t = { id: d.id, ...d.data() } as FinancialTask;
        rawTasks.push(t);
        if (t.status === 'COMPLETED') completedAmount += Number(t.amount || 0);
      });

      // Budget
      let budgetSnap = await getDocs(collection(db, 'companies', companyId, 'budgets'));
      let openBal = 0;
      if (!budgetSnap.empty) {
        openBal = Number(budgetSnap.docs[0].data().openingBalance || 0);
      }

      const currentBalance = openBal + incTotal - completedAmount - expTotal;
      setAvailableBalance(currentBalance);

      // Deterministic allocation pass
      const pendingTasks = rawTasks
        .filter((t) => t.status === 'PENDING' || t.status === 'READY_TO_COMPLETE')
        .sort((a, b) => {
          const d = a.dueDate.localeCompare(b.dueDate);
          if (d !== 0) return d;
          return a.createdAt.localeCompare(b.createdAt);
        });

      let remainingCash = currentBalance;
      const evaluated = rawTasks.map((task) => {
        if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
          return task;
        }
        if (remainingCash >= task.amount) {
          remainingCash -= task.amount;
          return { ...task, status: 'READY_TO_COMPLETE' as FinancialTaskStatus, allocatedAmount: task.amount };
        } else {
          const alloc = Math.max(0, remainingCash);
          remainingCash = 0;
          return { ...task, status: 'PENDING' as FinancialTaskStatus, allocatedAmount: alloc };
        }
      });

      evaluated.sort((a, b) => {
        if (a.status === 'READY_TO_COMPLETE' && b.status !== 'READY_TO_COMPLETE') return -1;
        if (b.status === 'READY_TO_COMPLETE' && a.status !== 'READY_TO_COMPLETE') return 1;
        return a.dueDate.localeCompare(b.dueDate);
      });

      setTasks(evaluated);
    } catch (err) {
      console.error('[Tasks] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasksAndBalance();
  }, [companyId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'tasks'));
      const now = new Date().toISOString();

      const newTask: FinancialTask = {
        id: newRef.id,
        companyId,
        title: title.trim(),
        amount: Number(amount),
        dueDate,
        createdAt: now,
        notes: notes.trim(),
        status: 'PENDING',
        allocatedAmount: 0,
      };

      await setDoc(doc(db, 'companies', companyId, 'tasks', newRef.id), newTask);
      await setDoc(newRef, newTask);

      setShowModal(false);
      setTitle('');
      setAmount('');
      setDueDate('');
      setNotes('');
      loadTasksAndBalance();
    } catch (err: any) {
      console.error('[Tasks] Add error:', err);
      alert('Failed to create task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (task: FinancialTask) => {
    if (!isAdmin) {
      alert('Only administrators are authorized to complete financial disbursements.');
      return;
    }
    if (availableBalance < task.amount) {
      alert(`Cannot complete task. Available balance is insufficient by ₹${(task.amount - availableBalance).toLocaleString('en-IN')}`);
      return;
    }
    if (!confirm(`Confirm completion & fund disbursement of ₹${task.amount.toLocaleString('en-IN')} for "${task.title}"?`)) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const updates = {
        status: 'COMPLETED',
        completedAt: now,
        completedByUid: user?.uid,
        completedByName: user?.displayName,
      };

      await updateDoc(doc(db, 'companies', companyId, 'tasks', task.id), updates);
      await updateDoc(doc(db, 'tasks', task.id), updates);

      loadTasksAndBalance();
    } catch (err: any) {
      console.error('[Tasks] Complete error:', err);
      alert('Failed to complete task: ' + err.message);
    }
  };

  return (
    <AppLayout>
      <Head>
        <title>Financial Tasks &amp; Allocations — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Task Allocation</h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated chronological allocation of available liquid company balance
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Financial Task
        </button>
      </div>

      {/* Available Balance Status Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase">Available Liquid Balance</span>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">
            ₹{availableBalance.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="text-xs text-slate-600 max-w-sm text-right">
          <p>Tasks turn <strong>READY_TO_COMPLETE</strong> strictly in chronological order as company cash becomes available.</p>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No financial tasks found. Click "Create Financial Task" to add obligations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Task Title</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Funding Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const isReady = task.status === 'READY_TO_COMPLETE';
                  const isCompleted = task.status === 'COMPLETED';
                  const shortfall = Math.max(0, task.amount - (task.allocatedAmount || 0));

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">{task.dueDate}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{task.title}</p>
                        {task.notes && <p className="text-[11px] text-slate-400 truncate max-w-xs">{task.notes}</p>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{Number(task.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-slate-100 text-slate-700'
                              : isReady
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isCompleted ? (
                          <span className="text-[11px] text-slate-500">Disbursed on {task.completedAt?.slice(0, 10)}</span>
                        ) : isReady ? (
                          <span className="text-[11px] font-semibold text-emerald-600">100% Funds Allocated</span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">
                            Shortfall: ₹{shortfall.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isCompleted ? (
                          <span className="text-[11px] text-slate-400 font-medium">Completed</span>
                        ) : (
                          <button
                            onClick={() => handleCompleteTask(task)}
                            disabled={!isReady || !isAdmin}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                              isReady && isAdmin
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            Mark Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Financial Task</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Office Rent, Cloud Server, Vendor Payment"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Required (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 30000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Vendor contact, bank account, etc."
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
                  {submitting ? 'Creating...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
