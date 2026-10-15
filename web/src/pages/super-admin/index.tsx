import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../lib/authContext';
import {
  ShieldAlert,
  Building2,
  Users,
  CheckCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  Power,
  KeyRound,
  Filter,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

const SUPER_ADMIN_EMAILS = [
  'admin@vivexatech.in',
  'superadmin@vivexatech.in',
  'superadmin@expensemanager.com',
];

export default function SuperAdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    totalCompanies: 0,
    activeCompanies: 0,
    suspendedCompanies: 0,
    totalUsers: 0,
    recentCompanies: [],
  });
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isSuperAdmin = Boolean(
    user && (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '') || (user as any).superAdmin)
  );

  const loadData = async () => {
    if (!user) return;
    try {
      setRefreshing(true);
      const token = await (await import('../../lib/firebase')).auth.currentUser?.getIdToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [overviewRes, companiesRes] = await Promise.all([
        fetch('/api/super-admin/overview', { headers }),
        fetch('/api/super-admin/companies', { headers }),
      ]);

      if (overviewRes.ok) {
        const oJson = await overviewRes.json();
        setMetrics(oJson);
      }
      if (companiesRes.ok) {
        const cJson = await companiesRes.json();
        setCompanies(cJson.companies || []);
      }
    } catch (err) {
      console.error('[SuperAdmin] Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      loadData();
    } else if (!authLoading && !isSuperAdmin) {
      setLoading(false);
    }
  }, [user, authLoading, isSuperAdmin]);

  const handleToggleStatus = async (companyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg =
      nextStatus === 'SUSPENDED'
        ? `Are you sure you want to suspend this company? Their members will be restricted from accessing the application, but all financial records remain preserved.`
        : `Activate this company?`;

    if (!confirm(confirmMsg)) return;

    try {
      setTogglingId(companyId);
      const token = await (await import('../../lib/firebase')).auth.currentUser?.getIdToken();
      const res = await fetch('/api/super-admin/toggle-company-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Optimistic update
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, status: nextStatus } : c))
      );
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating company status.');
    } finally {
      setTogglingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading Super Admin Portal...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Restricted</h1>
          <p className="text-xs text-slate-400 mt-2">
            This portal is strictly reserved for SaaS Platform Super Administrators. Your account ({user?.email || 'Guest'}) does not have platform-level access.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              Return to Company Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      (c.ownerEmail || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Head>
        <title>SaaS Super Admin Portal — Platform Overview</title>
      </Head>

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">Platform Super Admin</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Root SaaS
                </span>
              </div>
              <p className="text-xs text-slate-400">Owner portal for tenant oversight &amp; confidential settings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              Go to Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Companies</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {metrics.totalCompanies || companies.length}
            </div>
            <p className="mt-1 text-xs text-slate-400">Registered SaaS tenants</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Tenants</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-emerald-400">
              {metrics.activeCompanies || companies.filter((c) => c.status === 'ACTIVE').length}
            </div>
            <p className="mt-1 text-xs text-slate-400">Healthy active subscriptions</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suspended Tenants</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-amber-400">
              {metrics.suspendedCompanies || companies.filter((c) => c.status === 'SUSPENDED').length}
            </div>
            <p className="mt-1 text-xs text-slate-400">Locked access (data preserved)</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Users</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-purple-400">
              {metrics.totalUsers || 0}
            </div>
            <p className="mt-1 text-xs text-slate-400">Total registered members</p>
          </div>
        </div>

        {/* Company Directory */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                Company Directory &amp; Tenant Controls
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage company lifecycle, tenant suspension, and confidential permissions
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company, ID, GSTIN..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-y border-slate-700/60 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Confidential Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300">
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No companies match your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => {
                    const isAct = c.status === 'ACTIVE';
                    return (
                      <tr key={c.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: {c.id} {c.ownerEmail ? `• ${c.ownerEmail}` : ''}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[11px] ${
                              isAct
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            {c.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-200">{c.memberCount || 1} members</span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {c.gstin ? (
                            <span className="text-indigo-400 font-semibold">{c.gstin}</span>
                          ) : (
                            <span className="text-slate-500 italic">Non-GST</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {c.allowAlternativeInvoiceType ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold">
                              <KeyRound className="w-3 h-3" />
                              Alternative Invoicing Allowed
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Default Only</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Toggle Suspend/Activate */}
                            <button
                              onClick={() => handleToggleStatus(c.id, c.status)}
                              disabled={togglingId === c.id}
                              title={isAct ? 'Suspend Company' : 'Activate Company'}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isAct
                                  ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* View Detail Page */}
                            <Link
                              href={`/super-admin/companies/${c.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-[11px] transition-all"
                            >
                              Manage
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
