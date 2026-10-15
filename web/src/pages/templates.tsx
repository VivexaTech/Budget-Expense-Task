import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InvoiceTemplateId } from '../types';
import { Palette, Check, Eye, ShieldCheck, Sparkles } from 'lucide-react';

interface TemplateOption {
  id: InvoiceTemplateId;
  name: string;
  tagline: string;
  badge: string;
  primaryColor: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'CORPORATE',
    name: 'Professional Corporate',
    tagline: 'Structured formal layout with border banners and verified seal.',
    badge: 'Enterprise Default',
    primaryColor: '#1e3a8a',
  },
  {
    id: 'MINIMAL',
    name: 'Ultra Minimal',
    tagline: 'Contemporary typography, generous whitespace, sleek borderless grid.',
    badge: 'Modern Tech',
    primaryColor: '#0f172a',
  },
  {
    id: 'MODERN_BLUE',
    name: 'Modern Blue',
    tagline: 'High-contrast vibrant blue header, pill badges, and dual-tone rows.',
    badge: 'Client Favorite',
    primaryColor: '#2563eb',
  },
  {
    id: 'CLASSIC_GST',
    name: 'Classic GST Format',
    tagline: 'Statutory Indian GST layout with dedicated HSN/SAC and CGST/SGST tax breakdown.',
    badge: 'Statutory Compliant',
    primaryColor: '#1e293b',
  },
];

export default function TemplatesPage() {
  const { user, company, companyId } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateId>('CORPORATE');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadActiveTemplate() {
      if (!companyId) return;
      try {
        const snap = await getDoc(doc(db, 'companies', companyId, 'settings', 'general'));
        if (snap.exists() && snap.data().activeTemplateId) {
          setSelectedTemplate(snap.data().activeTemplateId);
        }
      } catch (err) {
        console.error('[Templates] Error loading template setting:', err);
      }
    }
    loadActiveTemplate();
  }, [companyId]);

  const handleSaveDefault = async () => {
    if (!companyId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(
        doc(db, 'companies', companyId, 'settings', 'general'),
        { activeTemplateId: selectedTemplate },
        { merge: true }
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('[Templates] Error saving setting:', err);
      alert('Failed to save default template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <Head>
        <title>Invoice Templates — CompanyBudget</title>
      </Head>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customizable Invoice Templates</h1>
          <p className="text-xs text-slate-500 mt-1">
            Select and customize the default PDF invoice layout for {company?.name || user?.companyName}
          </p>
        </div>

        <button
          onClick={handleSaveDefault}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Saving...' : saveSuccess ? 'Saved as Workspace Default!' : 'Set as Workspace Default'}
        </button>
      </div>

      {/* Template Card Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {TEMPLATES.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          return (
            <div
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`p-5 rounded-xl bg-white border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {tmpl.badge}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2">{tmpl.name}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{tmpl.tagline}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Accent:</span>
                <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tmpl.primaryColor }} />
                  {tmpl.primaryColor}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Interactive Preview Box */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Live Preview: {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
            </h2>
          </div>
          <span className="text-xs text-slate-400">Sample Render Data</span>
        </div>

        {/* Dynamic Template Mock Preview */}
        <div className="max-w-2xl mx-auto p-6 sm:p-8 border border-slate-200 rounded-xl shadow-inner bg-white">
          {/* Header depending on template */}
          {selectedTemplate === 'MODERN_BLUE' && (
            <div className="p-4 bg-blue-600 text-white rounded-lg flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold">{company?.name || 'VIVEXA TECHNOLOGIES'}</h3>
                <p className="text-[10px] text-blue-100">Enterprise Budget Platform</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold">TAX INVOICE</span>
                <p className="text-[10px] font-mono text-blue-100">VTX-2026-10-001</p>
              </div>
            </div>
          )}

          {selectedTemplate === 'CORPORATE' && (
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">{company?.name || 'VIVEXA TECHNOLOGIES'}</h3>
                <p className="text-xs text-slate-500">Corporate Financial Services</p>
                <p className="text-[10px] font-mono text-slate-600 mt-1">GSTIN: 29ABCDE1234F1Z5</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-blue-800 uppercase tracking-widest">TAX INVOICE</span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-1">VTX-2026-10-001</p>
                <p className="text-[10px] text-slate-500">Date: 2026-10-15</p>
              </div>
            </div>
          )}

          {selectedTemplate === 'MINIMAL' && (
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-light tracking-widest text-slate-800 uppercase">{company?.name || 'VIVEXA TECHNOLOGIES'}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Software &amp; Digital Solutions</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-400">Invoice</span>
                <p className="text-xs font-bold text-slate-800">#VTX-2026-10-001</p>
              </div>
            </div>
          )}

          {selectedTemplate === 'CLASSIC_GST' && (
            <div className="border border-slate-800 p-3 mb-4 flex justify-between items-center text-center">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-900">{company?.name || 'VIVEXA TECHNOLOGIES'}</h3>
                <p className="text-[10px] text-slate-600">GSTIN: 29ABCDE1234F1Z5</p>
              </div>
              <div className="font-bold text-xs uppercase underline">TAX INVOICE (RULE 46)</div>
              <div className="text-right text-[10px]">
                <p className="font-mono font-bold">INV: VTX-2026-10-001</p>
                <p>Dated: 15-10-2026</p>
              </div>
            </div>
          )}

          {/* Sample Line Item Table */}
          <table className="w-full text-xs text-left border-collapse my-4">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                <th className="py-2 px-3">Item / Description</th>
                {selectedTemplate === 'CLASSIC_GST' && <th className="py-2 px-2">HSN/SAC</th>}
                <th className="py-2 px-3 text-right">Rate</th>
                <th className="py-2 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3">Enterprise Cloud Setup &amp; Migration</td>
                {selectedTemplate === 'CLASSIC_GST' && <td className="py-2.5 px-2 font-mono text-[10px]">998313</td>}
                <td className="py-2.5 px-3 text-right">₹10,000</td>
                <td className="py-2.5 px-3 text-right font-bold">₹10,000</td>
              </tr>
            </tbody>
          </table>

          {/* Tax Summary Preview */}
          <div className="flex justify-end pt-3">
            <div className="w-56 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Taxable Amount:</span>
                <span>₹10,000</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9%):</span>
                <span>₹900</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (9%):</span>
                <span>₹900</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm text-slate-900">
                <span>Invoice Total:</span>
                <span className="text-blue-600">₹11,800</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
