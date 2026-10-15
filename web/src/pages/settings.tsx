import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Building2, Save, KeyRound, Shield, CheckCircle2, Image as ImageIcon, UploadCloud, X, PenTool } from 'lucide-react';

export default function SettingsPage() {
  const { user, company, companyId } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'signature' | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Branding (Cloudinary Assets)
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Bank & Invoice Defaults
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [terms, setTerms] = useState('');

  // Neutral Authorization PINs
  const [allowAlternativeInvoiceType, setAllowAlternativeInvoiceType] = useState(false);
  const [hasAuthorizationPinConfigured, setHasAuthorizationPinConfigured] = useState(false);
  const [hasAlternativePinConfigured, setHasAlternativePinConfigured] = useState(false);
  const [newAuthorizationPin, setNewAuthorizationPin] = useState('');
  const [newAlternativePin, setNewAlternativePin] = useState('');

  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      try {
        const compSnap = await getDoc(doc(db, 'companies', companyId));
        if (compSnap.exists()) {
          const d = compSnap.data();
          setName(d.name || '');
          setGstin(d.gstin || '');
          setAddress(d.address || '');
          setCity(d.city || '');
          setState(d.state || 'Karnataka');
          setPinCode(d.pincode || '');
          setPhone(d.phone || '');
          setEmail(d.email || d.adminEmail || '');
        }

        const genSnap = await getDoc(doc(db, 'companies', companyId, 'settings', 'general'));
        if (genSnap.exists()) {
          const g = genSnap.data();
          setBankName(g.bankName || g.bankDetails?.bankName || '');
          setAccountNumber(g.accountNumber || g.bankDetails?.accountNumber || '');
          setIfscCode(g.ifscCode || g.bankDetails?.ifscCode || '');
          setUpiId(g.upiId || g.bankDetails?.upiId || '');
          setTerms(g.termsAndConditions || g.paymentTerms || '');
          setLogoUrl(g.logoUrl || '');
          setSignatureUrl(g.signatureUrl || '');
          setAllowAlternativeInvoiceType(Boolean(g.allowAlternativeInvoiceType));
          setHasAuthorizationPinConfigured(Boolean(g.primaryPinHash || g.gpinHash || g.npinHash));
          setHasAlternativePinConfigured(Boolean(g.alternativePinHash || (g.gstin ? g.npinHash : g.gpinHash)));
        }
      } catch (err) {
        console.error('[Settings] Load error:', err);
      }
    }
    loadSettings();
  }, [companyId]);

  // Handle Cloudinary upload for logo or signature
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetType: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please upload an image under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        setUploadingAsset(assetType);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const token = user ? await (await import('../lib/firebase')).auth.currentUser?.getIdToken() : '';
        const res = await fetch(`${apiUrl}/api/cloudinary-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            dataUrl: base64,
            assetType,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed.');
        if (assetType === 'logo') {
          setLogoUrl(data.secureUrl);
        } else {
          setSignatureUrl(data.secureUrl);
        }
      } catch (err: any) {
        console.error('Asset upload failed:', err);
        alert(err.message || 'Failed to upload asset.');
      } finally {
        setUploadingAsset(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators can update workspace settings.');
      return;
    }

    if (newAuthorizationPin && !/^\d{6}$/.test(newAuthorizationPin.trim())) {
      alert('Authorization PIN must be exactly 6 numeric digits.');
      return;
    }

    if (newAlternativePin && !/^\d{6}$/.test(newAlternativePin.trim())) {
      alert('Alternative Authorization PIN must be exactly 6 numeric digits.');
      return;
    }

    setSaving(true);
    setSuccess(false);
    try {
      // 1. Update Company Doc
      await setDoc(
        doc(db, 'companies', companyId),
        {
          name: name.trim(),
          gstin: gstin.trim().toUpperCase(),
          address: address.trim(),
          city: city.trim(),
          state,
          pincode: pinCode.trim(),
          phone: phone.trim(),
          email: email.trim(),
        },
        { merge: true }
      );

      // 2. Update General Settings Doc
      const bankDetails = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
      };

      await setDoc(
        doc(db, 'companies', companyId, 'settings', 'general'),
        {
          businessName: name.trim(),
          businessAddress: address.trim(),
          city: city.trim(),
          state,
          pincode: pinCode.trim(),
          gstin: gstin.trim().toUpperCase(),
          contactPhone: phone.trim(),
          contactEmail: email.trim(),
          logoUrl,
          signatureUrl,
          bankDetails,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          upiId: upiId.trim(),
          termsAndConditions: terms.trim(),
          paymentTerms: terms.trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.displayName || user?.email,
        },
        { merge: true }
      );

      // 3. Update Invoice Settings & PINs via backend API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const token = user ? await (await import('../lib/firebase')).auth.currentUser?.getIdToken() : '';
      await fetch(`${apiUrl}/api/invoice-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId,
          businessName: name.trim(),
          businessAddress: address.trim(),
          city: city.trim(),
          state,
          pincode: pinCode.trim(),
          gstin: gstin.trim().toUpperCase(),
          contactPhone: phone.trim(),
          contactEmail: email.trim(),
          logoUrl,
          signatureUrl,
          bankDetails,
          paymentTerms: terms.trim(),
          authorizationPin: newAuthorizationPin.length === 6 ? newAuthorizationPin : undefined,
          alternativePin: newAlternativePin.length === 6 ? newAlternativePin : undefined,
          requestingUserUid: user?.uid,
        }),
      });

      if (newAuthorizationPin) {
        setHasAuthorizationPinConfigured(true);
        setNewAuthorizationPin('');
      }
      if (newAlternativePin) {
        setHasAlternativePinConfigured(true);
        setNewAlternativePin('');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      console.error('[Settings] Save error:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <Head>
        <title>Workspace Settings — CompanyBudget</title>
      </Head>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspace Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure company branding, statutory GST details, invoice banking, and security PINs
          </p>
        </div>

        {success && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Settings saved successfully!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Company Identity */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Company Identity &amp; Statutory GSTIN
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Trade Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company GSTIN</label>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="29ABCDE1234F1Z5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Cloudinary Company Branding: Logo & Signature */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-indigo-600" />
            Company Branding &amp; Signature (Cloudinary Secured)
          </h3>
          <p className="text-xs text-slate-500">
            Assets are safely hosted on Cloudinary and immutably captured in generated invoice snapshots.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Company Logo */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  Company Logo
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Displayed on top of invoice headers. Max size: 2MB (PNG, JPG, SVG).
                </p>

                {logoUrl ? (
                  <div className="relative border border-slate-200 bg-white rounded-lg p-3 flex items-center justify-center h-28 mb-3">
                    <img src={logoUrl} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute top-1.5 right-1.5 p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600"
                      title="Remove Logo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 bg-white rounded-lg h-28 flex flex-col items-center justify-center text-slate-400 mb-3">
                    <UploadCloud className="w-6 h-6 mb-1 text-slate-300" />
                    <span className="text-xs">No logo uploaded</span>
                  </div>
                )}
              </div>

              <div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-all">
                  <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                  {uploadingAsset === 'logo' ? 'Uploading...' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAsset !== null}
                    onChange={(e) => handleFileUpload(e, 'logo')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Authorized Signature */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-purple-600" />
                  Authorized Signatory
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Official signature stamped on invoice footer. Transparent PNG recommended.
                </p>

                {signatureUrl ? (
                  <div className="relative border border-slate-200 bg-white rounded-lg p-3 flex items-center justify-center h-28 mb-3">
                    <img src={signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      className="absolute top-1.5 right-1.5 p-1 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600"
                      title="Remove Signature"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 bg-white rounded-lg h-28 flex flex-col items-center justify-center text-slate-400 mb-3">
                    <PenTool className="w-6 h-6 mb-1 text-slate-300" />
                    <span className="text-xs">No signature uploaded</span>
                  </div>
                )}
              </div>

              <div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-all">
                  <UploadCloud className="w-3.5 h-3.5 text-purple-600" />
                  {uploadingAsset === 'signature' ? 'Uploading...' : signatureUrl ? 'Replace Signature' : 'Upload Signature'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAsset !== null}
                    onChange={(e) => handleFileUpload(e, 'signature')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Banking Defaults for Invoices */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Invoice Banking &amp; Payment Terms
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50200012345678"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="HDFC0001234"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="company@hdfcbank"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Payment Terms &amp; Conditions</label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Payment due within 15 days of invoice date."
            />
          </div>
        </div>

        {/* Confidential Private Invoice Authorization Security */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              Invoice Authorization Security (Cryptographic HMAC-SHA256)
            </h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${hasAuthorizationPinConfigured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
              {hasAuthorizationPinConfigured ? 'PIN Active' : 'Unconfigured'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Set your secure 6-digit authorization PIN required to authorize and issue official client invoices. Leave blank to keep existing credentials.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {hasAuthorizationPinConfigured ? 'Change Authorization PIN (6 Digits)' : 'Set Authorization PIN (6 Digits)'}
              </label>
              <input
                type="password"
                maxLength={6}
                value={newAuthorizationPin}
                onChange={(e) => setNewAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Primary PIN used to authenticate official invoices.
              </p>
            </div>

            {/* Alternative Authorization PIN: Rendered ONLY if Super Admin granted permission */}
            {allowAlternativeInvoiceType && gstin.trim().length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {hasAlternativePinConfigured ? 'Change Alternative Authorization PIN (6 Digits)' : 'Set Alternative Authorization PIN (6 Digits)'}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newAlternativePin}
                  onChange={(e) => setNewAlternativePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Secondary authorization PIN for alternative invoice workflows.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !isAdmin}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
