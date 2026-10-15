import { Invoice, InvoiceTemplateConfig, DEFAULT_INVOICE_TEMPLATES } from '../types';

export function generateInvoiceHtml(invoice: Invoice): string {
  const isGst = invoice.invoiceType === 'GST';
  const isSameState = invoice.isSameStateSupply;

  const supplier = invoice.supplierBusinessDetailsSnapshot;
  const client = invoice.clientBillingDetailsSnapshot;

  const templateConfig: InvoiceTemplateConfig =
    invoice.templateSnapshot ||
    (invoice.templateId && DEFAULT_INVOICE_TEMPLATES[invoice.templateId]) ||
    DEFAULT_INVOICE_TEMPLATES.CORPORATE;

  const templateId = templateConfig.id || 'CORPORATE';
  const primaryColor = templateConfig.primaryColor || '#1A73E8';
  const accentColor = templateConfig.accentColor || '#0D47A1';
  const headingText = templateConfig.heading || (isGst ? 'TAX INVOICE' : 'COMMERCIAL INVOICE');

  const formattedTotal = Number(invoice.totalInvoiceAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedTaxable = Number(invoice.taxableAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedOriginal = Number(invoice.originalAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedDiscount = Number(invoice.discountAmount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Common tax rows
  const taxRowsHtml = isGst ? `
    <tr>
      <td>Taxable Value:</td>
      <td class="text-right">₹${formattedTaxable}</td>
    </tr>
    ${isSameState ? `
    <tr>
      <td>CGST (${invoice.cgstRate}%):</td>
      <td class="text-right">₹${invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
    <tr>
      <td>SGST (${invoice.sgstRate}%):</td>
      <td class="text-right">₹${invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
    ` : `
    <tr>
      <td>IGST (${invoice.igstRate}%):</td>
      <td class="text-right">₹${invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
    `}
  ` : '';

  // Render specific layout variations
  if (templateId === 'MINIMAL') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      background-color: #ffffff;
      padding: 40px;
      font-size: 13px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 300;
      color: ${primaryColor};
      letter-spacing: -0.5px;
    }
    .invoice-tag { text-align: right; }
    .invoice-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #111827;
      text-transform: uppercase;
    }
    .invoice-num { font-size: 14px; color: #4b5563; font-weight: 500; margin-top: 4px; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 36px;
    }
    .party-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .party-name { font-size: 15px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      border-bottom: 1px solid #d1d5db;
      padding: 10px 8px;
    }
    td { padding: 14px 8px; border-bottom: 1px solid #f3f4f6; }
    .text-right { text-align: right; }
    .summary-wrap { display: flex; justify-content: flex-end; }
    .summary-table { width: 320px; }
    .summary-table td { padding: 6px 8px; }
    .total-row td {
      border-top: 1px solid #111827;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      padding-top: 10px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #f3f4f6;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">${supplier.businessName}</div>
      <div style="color: #6b7280; margin-top: 4px;">${supplier.businessAddress}, ${supplier.city || ''}</div>
      ${supplier.gstin ? `<div style="font-size: 11px; color: #6b7280;">GSTIN: ${supplier.gstin}</div>` : ''}
    </div>
    <div class="invoice-tag">
      <div class="invoice-title">${headingText}</div>
      <div class="invoice-num"># ${invoice.invoiceNumber}</div>
      <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Date: ${invoice.invoiceDate}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-title">Billed To</div>
      <div class="party-name">${client.clientName}</div>
      ${client.companyName ? `<div style="font-weight: 500;">${client.companyName}</div>` : ''}
      <div>${client.billingAddress || ''}</div>
      <div>${client.city ? `${client.city}, ` : ''}${client.state} ${client.pincode ? `- ${client.pincode}` : ''}</div>
      ${client.gstin ? `<div style="font-size: 11px; margin-top: 4px;">GSTIN: ${client.gstin}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div class="party-title">Payment Status</div>
      <div style="display: inline-block; padding: 4px 10px; background-color: #ecfdf5; color: #065f46; border-radius: 4px; font-weight: 600; font-size: 12px;">PAID IN FULL</div>
      <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">Service: <strong>${invoice.serviceName}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Description</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Rate</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div style="font-weight: 600; color: #111827;">${invoice.serviceName}</div>
          <div style="font-size: 11px; color: #6b7280;">Professional services delivered and verified</div>
        </td>
        <td class="text-right">1</td>
        <td class="text-right">₹${formattedOriginal}</td>
        <td class="text-right">₹${formattedOriginal}</td>
      </tr>
      ${invoice.discountAmount > 0 ? `
      <tr>
        <td style="color: #dc2626;">Discount (${invoice.discountType === 'PERCENTAGE' ? `${invoice.discountValue}%` : 'Fixed'})</td>
        <td class="text-right">-</td>
        <td class="text-right">-</td>
        <td class="text-right" style="color: #dc2626;">-₹${formattedDiscount}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>

  <div class="summary-wrap">
    <table class="summary-table">
      ${taxRowsHtml}
      <tr class="total-row">
        <td>Total:</td>
        <td class="text-right">₹${formattedTotal}</td>
      </tr>
      <tr>
        <td style="color: #059669; font-weight: 600;">Paid:</td>
        <td class="text-right" style="color: #059669; font-weight: 600;">₹${formattedTotal}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    ${templateConfig.showNotes ? `<div><strong>Notes:</strong> ${supplier.invoiceNotes || 'Thank you for your business.'}</div>` : ''}
    ${templateConfig.footerText ? `<div style="margin-top: 4px;">${templateConfig.footerText}</div>` : ''}
  </div>
</body>
</html>`;
  }

  if (templateId === 'MODERN_BLUE') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-bar {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);
      color: #ffffff;
      padding: 36px 36px 30px;
    }
    .header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
    .brand-title { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header-sub { opacity: 0.85; font-size: 12px; margin-top: 4px; }
    .inv-card {
      text-align: right;
    }
    .inv-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 1px;
    }
    .inv-num { font-size: 20px; font-weight: 700; margin-top: 8px; }
    .content { padding: 32px 36px; }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    .card-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 12px 14px;
      border: none;
    }
    td { padding: 14px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .summary-wrap { display: flex; justify-content: flex-end; }
    .summary-box {
      width: 340px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand-total {
      border-top: 2px solid ${primaryColor};
      padding-top: 10px;
      margin-top: 8px;
      font-size: 16px;
      font-weight: 800;
      color: ${primaryColor};
    }
    .footer-bar {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-flex">
      <div>
        <div class="brand-title">${supplier.businessName}</div>
        <div class="header-sub">${supplier.businessAddress}, ${supplier.city || ''} ${supplier.pincode ? `- ${supplier.pincode}` : ''}</div>
        ${supplier.gstin ? `<div class="header-sub">GSTIN: ${supplier.gstin}</div>` : ''}
      </div>
      <div class="inv-card">
        <div class="inv-badge">${headingText}</div>
        <div class="inv-num">${invoice.invoiceNumber}</div>
        <div style="opacity: 0.85; font-size: 12px; margin-top: 2px;">Date: ${invoice.invoiceDate}</div>
      </div>
    </div>
  </div>

  <div class="content">
    <div class="cards-grid">
      <div class="card">
        <div class="card-label">Customer Details</div>
        <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${client.clientName}</div>
        ${client.companyName ? `<div style="color: #475569; font-weight: 600;">${client.companyName}</div>` : ''}
        <div style="color: #64748b; margin-top: 4px;">${client.billingAddress || ''}</div>
        <div style="color: #64748b;">${client.city ? `${client.city}, ` : ''}${client.state}</div>
        ${client.gstin ? `<div style="font-weight: 600; color: #334155; margin-top: 4px;">GSTIN: ${client.gstin}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-label">Invoice Summary</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Service:</span>
          <strong>${invoice.serviceName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748b;">Place of Supply:</span>
          <strong>${client.state}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Status:</span>
          <span style="color: #059669; font-weight: 700;">PAID IN FULL</span>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item / Service</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${invoice.serviceName}</div>
            <div style="font-size: 11px; color: #64748b;">Professional budget execution and task fulfillment</div>
          </td>
          <td class="text-right">1</td>
          <td class="text-right">₹${formattedOriginal}</td>
          <td class="text-right">₹${formattedOriginal}</td>
        </tr>
        ${invoice.discountAmount > 0 ? `
        <tr>
          <td style="color: #dc2626;">Promotional Discount</td>
          <td class="text-right">-</td>
          <td class="text-right">-</td>
          <td class="text-right" style="color: #dc2626;">-₹${formattedDiscount}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>

    <div class="summary-wrap">
      <div class="summary-box">
        ${isGst ? `
        <div class="summary-row">
          <span style="color: #64748b;">Taxable Value:</span>
          <span>₹${formattedTaxable}</span>
        </div>
        ${isSameState ? `
        <div class="summary-row">
          <span style="color: #64748b;">CGST (${invoice.cgstRate}%):</span>
          <span>₹${invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="summary-row">
          <span style="color: #64748b;">SGST (${invoice.sgstRate}%):</span>
          <span>₹${invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : `
        <div class="summary-row">
          <span style="color: #64748b;">IGST (${invoice.igstRate}%):</span>
          <span>₹${invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        `}
        ` : ''}
        <div class="summary-row grand-total">
          <span>Amount Paid:</span>
          <span>₹${formattedTotal}</span>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <div>
        ${templateConfig.showPaymentTerms ? `<div style="color: #64748b; font-size: 11px;">Terms: ${supplier.paymentTerms || 'Paid upon receipt.'}</div>` : ''}
        ${templateConfig.footerText ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">${templateConfig.footerText}</div>` : ''}
      </div>
      ${templateConfig.showSignatureArea ? `
      <div style="text-align: right;">
        <div style="font-weight: 700; color: #0f172a;">${supplier.businessName}</div>
        <div style="margin-top: 32px; border-top: 1px dashed #cbd5e1; padding-top: 4px; font-size: 11px; color: #64748b;">
          Authorized Signature
        </div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
  }

  if (templateId === 'CLASSIC_GST') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GST Invoice - ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      background: #fff;
      padding: 24px;
      font-size: 12px;
      line-height: 1.4;
    }
    .bordered-box {
      border: 1.5px solid #000;
      margin-bottom: 16px;
    }
    .header-center {
      text-align: center;
      padding: 12px;
      border-bottom: 1.5px solid #000;
    }
    .company-title { font-size: 20px; font-weight: bold; }
    .invoice-title { font-size: 14px; font-weight: bold; margin-top: 4px; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .cell { padding: 8px 12px; border-bottom: 1px solid #000; }
    .cell-border-right { border-right: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 8px; }
    th { background: #f0f0f0; text-align: center; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <div class="bordered-box">
    <div class="header-center">
      <div class="company-title">${supplier.businessName}</div>
      <div>${supplier.businessAddress}, ${supplier.city || ''}, ${supplier.state} - ${supplier.pincode || ''}</div>
      <div><strong>GSTIN:</strong> ${supplier.gstin || 'N/A'} | <strong>PAN:</strong> ${supplier.gstin ? supplier.gstin.substring(2, 12) : 'N/A'}</div>
      <div class="invoice-title">${headingText}</div>
    </div>

    <div class="grid-2">
      <div class="cell cell-border-right">
        <div><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
        <div><strong>Invoice Date:</strong> ${invoice.invoiceDate}</div>
        <div><strong>State:</strong> ${supplier.state}</div>
      </div>
      <div class="cell">
        <div><strong>Transport Mode:</strong> Direct Delivery</div>
        <div><strong>Place of Supply:</strong> ${client.state}</div>
        <div><strong>Reverse Charge:</strong> No</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="cell cell-border-right">
        <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">Details of Receiver (Billed To):</div>
        <div><strong>Name:</strong> ${client.clientName}</div>
        ${client.companyName ? `<div><strong>Company:</strong> ${client.companyName}</div>` : ''}
        <div><strong>Address:</strong> ${client.billingAddress || ''}, ${client.city || ''}</div>
        <div><strong>State:</strong> ${client.state} ${client.pincode ? `(${client.pincode})` : ''}</div>
        <div><strong>GSTIN:</strong> ${client.gstin || 'Unregistered'}</div>
      </div>
      <div class="cell">
        <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">Details of Consignee (Shipped To):</div>
        <div><strong>Name:</strong> ${client.clientName}</div>
        <div><strong>Address:</strong> ${client.billingAddress || ''}, ${client.city || ''}</div>
        <div><strong>State:</strong> ${client.state}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%;">S.No</th>
          <th style="width: 45%;">Description of Goods/Services</th>
          <th style="width: 12%;">HSN/SAC</th>
          <th style="width: 8%;">Qty</th>
          <th style="width: 15%;">Rate (₹)</th>
          <th style="width: 15%;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center">1</td>
          <td>
            <strong>${invoice.serviceName}</strong>
            <div>Professional IT and operational budget services</div>
          </td>
          <td class="text-center">998314</td>
          <td class="text-center">1</td>
          <td class="text-right">${formattedTaxable}</td>
          <td class="text-right">${formattedTaxable}</td>
        </tr>
        <tr>
          <td colspan="5" class="text-right"><strong>Total Taxable Value</strong></td>
          <td class="text-right">₹${formattedTaxable}</td>
        </tr>
        ${isSameState ? `
        <tr>
          <td colspan="5" class="text-right">CGST (${invoice.cgstRate}%)</td>
          <td class="text-right">₹${invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td colspan="5" class="text-right">SGST (${invoice.sgstRate}%)</td>
          <td class="text-right">₹${invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ` : `
        <tr>
          <td colspan="5" class="text-right">IGST (${invoice.igstRate}%)</td>
          <td class="text-right">₹${invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        `}
        <tr style="font-weight: bold; font-size: 13px; background: #fafafa;">
          <td colspan="5" class="text-right">Grand Total (INR):</td>
          <td class="text-right">₹${formattedTotal}</td>
        </tr>
      </tbody>
    </table>

    <div class="grid-2">
      <div class="cell cell-border-right" style="border-bottom: none;">
        <div><strong>Declaration:</strong></div>
        <div style="font-size: 10px; color: #444; margin-top: 4px;">${templateConfig.footerText || 'We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct.'}</div>
      </div>
      <div class="cell" style="border-bottom: none; text-align: right;">
        <div><strong>For ${supplier.businessName}</strong></div>
        <div style="margin-top: 40px; font-size: 11px;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // DEFAULT: CORPORATE TEMPLATE
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      padding: 32px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      color: #64748b;
      font-size: 12px;
      margin-top: 4px;
      max-width: 320px;
    }
    .invoice-tag { text-align: right; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .badge-gst { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-nongst { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .invoice-num { font-size: 20px; font-weight: 700; color: #0f172a; }
    .invoice-date { color: #64748b; font-size: 12px; margin-top: 2px; }
    .parties-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .party-col { flex: 1; }
    .party-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .party-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .party-detail { color: #475569; font-size: 12px; margin-top: 2px; }
    .table-container { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .text-right { text-align: right; }
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .summary-table { width: 340px; border-collapse: collapse; }
    .summary-table td { padding: 6px 12px; font-size: 13px; }
    .grand-total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
      margin-top: 32px;
    }
    .terms-box { max-width: 420px; font-size: 11px; color: #64748b; line-height: 1.6; }
    .sign-box { text-align: right; width: 220px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">${supplier.businessName}</div>
      <div class="brand-sub">
        ${supplier.businessAddress}, ${supplier.city || ''}, ${supplier.state} - ${supplier.pincode || ''}<br/>
        ${supplier.gstin ? `<strong>GSTIN:</strong> ${supplier.gstin}<br/>` : ''}
        ${supplier.contactPhone ? `Phone: ${supplier.contactPhone} | ` : ''}${supplier.contactEmail ? `Email: ${supplier.contactEmail}` : ''}
      </div>
    </div>
    <div class="invoice-tag">
      <div class="badge ${isGst ? 'badge-gst' : 'badge-nongst'}">${headingText}</div>
      <div class="invoice-num">${invoice.invoiceNumber}</div>
      <div class="invoice-date">Date: ${invoice.invoiceDate}</div>
    </div>
  </div>

  <div class="parties-grid">
    <div class="party-col">
      <div class="party-title">Supplier (From)</div>
      <div class="party-name">${supplier.businessName}</div>
      <div class="party-detail">${supplier.businessAddress}</div>
      <div class="party-detail">${supplier.city ? `${supplier.city}, ` : ''}${supplier.state} - ${supplier.pincode || ''}</div>
      ${supplier.gstin ? `<div class="party-detail"><strong>GSTIN:</strong> ${supplier.gstin}</div>` : ''}
    </div>
    <div class="party-col">
      <div class="party-title">Billed To (Client)</div>
      <div class="party-name">${client.clientName}</div>
      ${client.companyName ? `<div class="party-detail" style="font-weight: 600;">${client.companyName}</div>` : ''}
      <div class="party-detail">${client.billingAddress || 'Address on file'}</div>
      <div class="party-detail">${client.city ? `${client.city}, ` : ''}${client.state} ${client.pincode ? `- ${client.pincode}` : ''}</div>
      ${client.gstin ? `<div class="party-detail"><strong>GSTIN:</strong> ${client.gstin}</div>` : ''}
      ${client.mobileNumber ? `<div class="party-detail">Mobile: ${client.mobileNumber}</div>` : ''}
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 55%;">Description of Service</th>
          <th class="text-right" style="width: 10%;">Qty</th>
          <th class="text-right" style="width: 15%;">Unit Rate</th>
          <th class="text-right" style="width: 15%;">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${invoice.serviceName}</div>
            <div style="color: #64748b; font-size: 11px;">Professional services rendered as per task agreement.</div>
          </td>
          <td class="text-right">1</td>
          <td class="text-right">₹${formattedOriginal}</td>
          <td class="text-right">₹${formattedOriginal}</td>
        </tr>
        ${invoice.discountAmount > 0 ? `
        <tr>
          <td>2</td>
          <td style="color: #dc2626;">Discount (${invoice.discountType === 'PERCENTAGE' ? `${invoice.discountValue}%` : 'Fixed'})</td>
          <td class="text-right">-</td>
          <td class="text-right">-</td>
          <td class="text-right" style="color: #dc2626;">-₹${formattedDiscount}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>
  </div>

  <div class="summary-section">
    <table class="summary-table">
      ${taxRowsHtml}
      <tr class="grand-total-row">
        <td>Total Amount:</td>
        <td class="text-right">₹${formattedTotal}</td>
      </tr>
      <tr>
        <td style="padding-top: 8px;">Amount Received:</td>
        <td class="text-right" style="padding-top: 8px; font-weight: 700; color: #059669;">₹${formattedTotal}</td>
      </tr>
      <tr>
        <td>Balance Due:</td>
        <td class="text-right" style="font-weight: 700;">₹0.00</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <div class="terms-box">
      <strong>Terms & Notes:</strong>
      <div>${supplier.paymentTerms || 'Payment received in full.'}</div>
      <div>${supplier.invoiceNotes || 'Thank you for choosing our services.'}</div>
      ${templateConfig.footerText ? `<div style="margin-top: 4px;">${templateConfig.footerText}</div>` : ''}
    </div>
    ${templateConfig.showSignatureArea ? `
    <div class="sign-box">
      <div style="font-weight: 700; color: #0f172a;">For ${supplier.businessName}</div>
      <div style="margin-top: 36px; border-top: 1px dashed #cbd5e1; padding-top: 4px; font-size: 11px; color: #64748b;">
        Authorized Signatory
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}
