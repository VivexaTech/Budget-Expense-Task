import { Invoice } from '../types';

export function generateInvoiceHtml(invoice: Invoice): string {
  const isGst = invoice.invoiceType === 'GST';
  const isSameState = invoice.isSameStateSupply;

  const supplier = invoice.supplierBusinessDetailsSnapshot;
  const client = invoice.clientBillingDetailsSnapshot;

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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
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
      border-bottom: 2px solid #e2e8f0;
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
    .invoice-tag {
      text-align: right;
    }
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
    .badge-gst {
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-nongst {
      background-color: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .invoice-num {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .invoice-date {
      color: #64748b;
      font-size: 12px;
      margin-top: 2px;
    }
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
    .party-col {
      flex: 1;
    }
    .party-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .party-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .party-detail {
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      color: #334155;
    }
    .text-right {
      text-align: right;
    }
    .totals-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 12px;
      border: none;
    }
    .grand-total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      padding: 10px 12px;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      background-color: #ecfdf5;
      color: #059669;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .terms-box {
      max-width: 60%;
    }
    .sign-box {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">${supplier.businessName}</div>
      <div class="brand-sub">
        ${supplier.businessAddress}${supplier.city ? `, ${supplier.city}` : ''}, ${supplier.state}${supplier.pincode ? ` - ${supplier.pincode}` : ''}
        ${supplier.contactPhone ? `<br>Phone: ${supplier.contactPhone}` : ''}
        ${supplier.contactEmail ? `<br>Email: ${supplier.contactEmail}` : ''}
        ${supplier.gstin ? `<br><strong>GSTIN: ${supplier.gstin}</strong>` : ''}
      </div>
    </div>
    <div class="invoice-tag">
      <div class="badge ${isGst ? 'badge-gst' : 'badge-nongst'}">
        ${isGst ? 'TAX INVOICE' : 'COMMERCIAL INVOICE'}
      </div>
      <div class="invoice-num">${invoice.invoiceNumber}</div>
      <div class="invoice-date">Date: ${invoice.invoiceDate}</div>
      <div style="margin-top: 6px;">
        <span class="status-badge">✓ PAID IN FULL</span>
      </div>
    </div>
  </div>

  <div class="parties-grid">
    <div class="party-col">
      <div class="party-title">Billed To</div>
      <div class="party-name">${client.clientName}</div>
      ${client.companyName ? `<div class="party-detail"><strong>${client.companyName}</strong></div>` : ''}
      ${client.contactPerson ? `<div class="party-detail">Attn: ${client.contactPerson}</div>` : ''}
      ${client.billingAddress ? `<div class="party-detail">${client.billingAddress}</div>` : ''}
      <div class="party-detail">${client.city ? `${client.city}, ` : ''}${client.state}${client.pincode ? ` - ${client.pincode}` : ''}</div>
      ${client.mobileNumber ? `<div class="party-detail">Mobile: ${client.mobileNumber}</div>` : ''}
      ${client.email ? `<div class="party-detail">Email: ${client.email}</div>` : ''}
      ${client.gstin ? `<div class="party-detail"><strong>GSTIN: ${client.gstin}</strong></div>` : ''}
    </div>
    <div class="party-col" style="text-align: right;">
      <div class="party-title">Supply Details</div>
      <div class="party-detail"><strong>Place of Supply:</strong> ${client.state}</div>
      <div class="party-detail"><strong>Supply Type:</strong> ${isSameState ? 'Intra-State (Same State)' : 'Inter-State'}</div>
      <div class="party-detail"><strong>Billing Month:</strong> ${invoice.invoiceMonth}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Description of Services</th>
        <th class="text-right" style="width: 100px;">Original</th>
        ${invoice.discountAmount > 0 ? `<th class="text-right" style="width: 90px;">Discount</th>` : ''}
        <th class="text-right" style="width: 100px;">Taxable</th>
        ${isGst ? (isSameState ? `
          <th class="text-right" style="width: 80px;">CGST (${invoice.cgstRate}%)</th>
          <th class="text-right" style="width: 80px;">SGST (${invoice.sgstRate}%)</th>
        ` : `
          <th class="text-right" style="width: 90px;">IGST (${invoice.igstRate}%)</th>
        `) : ''}
        <th class="text-right" style="width: 110px;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <strong>${invoice.serviceName}</strong>
          ${invoice.taskId ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ref Task #${invoice.taskId.slice(0, 8)}</div>` : ''}
        </td>
        <td class="text-right">₹${formattedOriginal}</td>
        ${invoice.discountAmount > 0 ? `<td class="text-right" style="color: #059669;">-₹${formattedDiscount}</td>` : ''}
        <td class="text-right">₹${formattedTaxable}</td>
        ${isGst ? (isSameState ? `
          <td class="text-right">₹${invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">₹${invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        ` : `
          <td class="text-right">₹${invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        `) : ''}
        <td class="text-right"><strong>₹${formattedTotal}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="totals-container">
    <table class="totals-table">
      <tr>
        <td>Gross Amount:</td>
        <td class="text-right">₹${formattedOriginal}</td>
      </tr>
      ${invoice.discountAmount > 0 ? `
      <tr>
        <td style="color: #059669;">Discount:</td>
        <td class="text-right" style="color: #059669;">-₹${formattedDiscount}</td>
      </tr>
      ` : ''}
      ${isGst ? `
      <tr>
        <td>Taxable Amount:</td>
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
      ` : ''}
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
    </div>
    <div class="sign-box">
      <div style="font-weight: 700; color: #0f172a;">For ${supplier.businessName}</div>
      <div style="margin-top: 36px; border-top: 1px dashed #cbd5e1; padding-top: 4px; font-size: 11px; color: #64748b;">
        Authorized Signatory
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
