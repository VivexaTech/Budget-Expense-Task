import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../../lib/authContext';
import {
  ShieldAlert,
  Building2,
  Users,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Power,
  KeyRound,
  Shield,
  Image as ImageIcon,
  PenTool,
  Save,
  Clock,
  Mail,
  MapPin,
  RefreshCw,
} from 'lucide-react';

const SUPER_ADMIN_EMAILS = [
  'admin@vivexatech.in',
  'superadmin@vivexatech.in',
  'superadmin@expensemanager.com',
];

export default function SuperAdminCompanyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allowAlternative, setAllowAlternative] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isSuperAdmin = Boolean(
    user && (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '') || (user as any).superAdmin)
  );

  const loadCompanyData = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      setLoading(true);
      const token = await (await import('../../../lib/firebase')).auth.currentUser?.getIdToken();
      const res = await fetch(`/api/super-admin/company-detail?id=${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to load company detail.');
      }

      const data = await res.json();
      setCompany(data.company);
      setMembers(data.members || []);
      setStatus(data.company.status || 'ACTIVE');
      setAllowAlternative(Boolean(data.company.settings?.allowAlternativeInvoiceType));
    } catch (err: any) {
      console.error('[SuperAdmin Detail] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSuperAdmin && id) {
      loadCompanyData();
    } else if (!authLoading && !isSuperAdmin) {
      setLoading(false);
    }
  }, [id, authLoading, isSuperAdmin]);

  const handleToggleStatus = async () => {
    const nextStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg =
      nextStatus === 'SUSPENDED'
        ? `Suspend "${company?.name}"? All members will be prevented from signing in. All financial records and historical invoices are strictly preserved.`
        : `Re-activate "${company?.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      setSaving(true);
      const token = await (await import('../../../lib/firebase')).auth.currentUser?.getIdToken();
      const res = await fetch('/api/super-admin/toggle-company-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId: id,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setStatus(nextStatus);
      setActionSuccess(`Company status changed to ${nextStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAlternativePermission = async (newVal: boolean) => {
    try {
      setSaving(true);
      const token = await (await import('../../../lib/firebase')).auth.currentUser?.getIdToken();
      const res = await fetch('/api/super-admin/toggle-invoice-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId: id,
          allowAlternativeInvoiceType: newVal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update permission');
      }

      setAllowAlternative(newVal);
      setActionSuccess(`Alternative invoice authorization permission set to ${newVal ? 'ENABLED' : 'DISABLED'}.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error updating permission');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading company details...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Access Restricted</h1>
          <p className="text-xs text-slate-400 mt-2">Super Admin credentials required.</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Company Not Found</h1>
          <p className="text-xs text-slate-400 mt-2">No company document exists with ID: {id}</p>
          <div className="mt-6">
            <Link href="/super-admin" className="px-4 py-2 bg-indigo-600 rounded-lg text-xs font-semibold text-white">
              Back to Companies
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAct = status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      <Head>
        <title>{company.name} — Super Admin Oversight</title>
      </Head>

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/super-admin"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base">{company.name}</h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isAct
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Tenant ID: {company.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actionSuccess && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                {actionSuccess}
              </div>
            )}
            <button
              onClick={handleToggleStatus}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isAct
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {isAct ? 'Suspend Company' : 'Re-activate Company'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Control Banners */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tenant Status & Suspension Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white">Tenant Lifecycle &amp; Access Control</h2>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isAct ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                {status}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              When a company is <strong>Suspended</strong>, all member logins, token refreshes, and API calls are immediately blocked.
              <span className="block mt-1 text-slate-400 text-[11px]">
                Preservation Guarantee: Financial ledgers, client invoices, partial payment records, and activity audit trails are never purged or altered.
              </span>
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={saving}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isAct
                    ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                <Power className="w-4 h-4" />
                {isAct ? 'Suspend All Tenant Logins' : 'Restore Active Tenant Status'}
              </button>
            </div>
          </div>

          {/* Confidential Private Invoice Permission */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <h2 className="text-sm font-bold text-white">Private Invoice Authorization</h2>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allowAlternative ? 'text-purple-400 bg-purple-500/10 border border-purple-500/20' : 'text-slate-400 bg-slate-700/40'}`}>
                {allowAlternative ? 'Permission Granted' : 'Disabled'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Strictly confidential authorization toggle. When enabled, this company is permitted to configure an alternative authorization PIN for secondary non-GST invoice generation.
            </p>

            <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Allow Alternative Invoice Type
                </span>
                <span className="text-[11px] text-slate-400">
                  {allowAlternative
                    ? 'Authorized for dual PIN workflow'
                    : 'Restricted strictly to default invoice type'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAlternative}
                  disabled={saving}
                  onChange={(e) => handleToggleAlternativePermission(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Company Profile & Cloudinary Branding */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identity Info */}
          <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-700/60 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Company Details &amp; Registration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Business Name</span>
                <span className="text-white font-medium">{company.settings?.businessName || company.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Registered GSTIN</span>
                <span className="text-indigo-400 font-mono font-bold">
                  {company.settings?.gstin || 'Non-GST Unregistered'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Admin / Owner Email</span>
                <span className="text-white">{company.ownerEmail || company.settings?.contactEmail || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Contact Phone</span>
                <span className="text-white">{company.settings?.contactPhone || 'N/A'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-semibold">Registered Address</span>
                <span className="text-slate-300">
                  {company.settings?.businessAddress ? `${company.settings.businessAddress}, ${company.settings.city || ''} ${company.settings.state || ''} ${company.settings.pincode ? `- ${company.settings.pincode}` : ''}` : 'No address configured'}
                </span>
              </div>
            </div>
          </div>

          {/* Cloudinary Assets Preview */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-700/60 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              Cloudinary Branding Assets
            </h3>

            {/* Logo */}
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1.5">Official Logo</span>
              {company.settings?.logoUrl ? (
                <div className="h-20 bg-slate-900 border border-slate-700/60 rounded-xl p-2 flex items-center justify-center">
                  <img
                    src={company.settings.logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-20 bg-slate-900/60 border border-dashed border-slate-700/60 rounded-xl flex items-center justify-center text-slate-500 text-xs">
                  No logo uploaded
                </div>
              )}
            </div>

            {/* Signature */}
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1.5">Authorized Signatory</span>
              {company.settings?.signatureUrl ? (
                <div className="h-20 bg-slate-900 border border-slate-700/60 rounded-xl p-2 flex items-center justify-center">
                  <img
                    src={company.settings.signatureUrl}
                    alt="Signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-20 bg-slate-900/60 border border-dashed border-slate-700/60 rounded-xl flex items-center justify-center text-slate-500 text-xs">
                  No signature uploaded
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Member Directory */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Registered Company Members ({members.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">User UID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-slate-300">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No members registered for this company.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.uid} className="hover:bg-slate-700/20">
                      <td className="py-2.5 px-3 font-semibold text-white">{m.displayName || 'Unnamed'}</td>
                      <td className="py-2.5 px-3 text-slate-300">{m.email}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-700/40 text-slate-300'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-400 font-semibold text-[11px]">{m.status}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{m.uid}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
