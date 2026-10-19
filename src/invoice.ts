import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { money, shortDate } from './dates';
import { jobTotals } from './finance';
import { receiptDataUrl } from './receipts';
import { BusinessInfo, Expense, Job, TimeEntry } from './types';

type InvoiceInput = {
  job: Job;
  number: number;
  entries: TimeEntry[];
  expenses: Expense[];
  business: BusinessInfo;
  technician?: string;
  machine?: string;
};

const esc = (s?: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function html({ job, number, entries, expenses, business, technician, machine }: InvoiceInput) {
  const t = jobTotals(job, entries, expenses);
  const time = entries.filter((e) => e.jobId === job.id).sort((a, b) => a.date.localeCompare(b.date));
  const exp = expenses.filter((e) => e.jobId === job.id).sort((a, b) => a.date.localeCompare(b.date));
  const receipts = (
    await Promise.all(
      exp.filter((e) => e.receiptUri).map(async (e) => ({ e, url: await receiptDataUrl(e.receiptUri!) })),
    )
  ).filter((r) => r.url);

  const paid = job.status === 'paid';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:36px;font-size:13px}
  h1{font-size:28px;margin:0 0 4px} .muted{color:#666}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .box{border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;margin-bottom:18px} th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:12px;text-transform:uppercase}
  td{border-bottom:1px solid #e5e5e5;padding:6px 4px;vertical-align:top} .r{text-align:right}
  .tot td{border:none;padding:3px 4px} .grand td{font-size:17px;font-weight:800;border-top:2px solid #111;padding-top:8px}
  .paid{display:inline-block;border:3px solid #15803d;color:#15803d;font-weight:900;font-size:20px;padding:6px 14px;border-radius:6px;transform:rotate(-4deg)}
  .rec{page-break-before:always} .rec img{max-width:100%;max-height:900px;display:block;margin:8px 0 18px}
  </style></head><body>
  <div class="top">
    <div><h1>${esc(business.name) || 'Invoice'}</h1>
      <div class="muted">${[business.address, business.phone, business.email].filter(Boolean).map(esc).join('<br>')}</div></div>
    <div style="text-align:right"><div style="font-size:20px;font-weight:800">INVOICE #${number}</div>
      <div class="muted">Date: ${shortDate(job.invoicedAt ?? new Date().toISOString())}</div>
      ${paid ? `<div style="margin-top:10px" class="paid">PAID${job.checkNumber ? ` · CHECK #${esc(job.checkNumber)}` : ''}</div>` : ''}
    </div>
  </div>
  <div class="box"><b>Bill to:</b> ${esc(job.client) || '—'}${job.clientContact ? `<br>${esc(job.clientContact)}` : ''}<br>
    <b>Job:</b> ${esc(job.title)}${machine ? ` · ${esc(machine)}` : ''}${technician ? `<br><b>Technician:</b> ${esc(technician)}` : ''}</div>
  ${
    time.length
      ? `<table><tr><th>Date</th><th>Labor</th><th class="r">Hours</th><th class="r">Rate</th><th class="r">Amount</th></tr>
    ${time.map((e) => `<tr><td>${shortDate(e.date)}</td><td>${esc(e.note) || 'Labor'}</td><td class="r">${e.hours}</td><td class="r">${money(job.rate)}</td><td class="r">${money(e.hours * job.rate)}</td></tr>`).join('')}
    </table>`
      : ''
  }
  ${
    exp.length
      ? `<table><tr><th>Date</th><th>Parts and expenses</th><th class="r">Amount</th></tr>
    ${exp.map((e) => `<tr><td>${shortDate(e.date)}</td><td>${esc(e.description)}${e.receiptUri ? ' <span class="muted">(receipt attached)</span>' : ''}</td><td class="r">${money(e.amount)}</td></tr>`).join('')}
    </table>`
      : ''
  }
  <table style="width:50%;margin-left:auto">
    <tr class="tot"><td>Labor (${t.hours} h)</td><td class="r">${money(t.labor)}</td></tr>
    <tr class="tot"><td>Parts and expenses</td><td class="r">${money(t.expenses)}</td></tr>
    <tr class="grand"><td>${paid ? 'Total paid' : 'Total due'}</td><td class="r">${money(t.total)}</td></tr>
  </table>
  ${job.notes ? `<div class="box"><b>Notes:</b> ${esc(job.notes)}</div>` : ''}
  ${paid ? `<p class="muted">Paid ${job.paidAt ? shortDate(job.paidAt) : ''}${job.checkNumber ? ` by check #${esc(job.checkNumber)}` : ''}. Thank you!</p>` : '<p class="muted">Thank you for your business.</p>'}
  ${receipts.map((r) => `<div class="rec"><b>Receipt:</b> ${esc(r.e.description)} · ${money(r.e.amount)} · ${shortDate(r.e.date)}<img src="${r.url}"></div>`).join('')}
  </body></html>`;
}

/** Make a PDF invoice and open the share sheet (text, email, etc.). */
export async function shareInvoicePdf(input: InvoiceInput) {
  const { uri } = await Print.printToFileAsync({ html: await html(input) });
  const named = `${FileSystem.cacheDirectory ?? ''}Invoice-${input.number}.pdf`;
  await FileSystem.deleteAsync(named, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: uri, to: named }).catch(() => {});
  const file = (await FileSystem.getInfoAsync(named)).exists ? named : uri;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Invoice #${input.number}` });
  } else {
    await shareInvoiceText(input);
  }
}

/** Plain-text invoice summary for a quick text message. */
export async function shareInvoiceText({ job, number, entries, expenses, business }: InvoiceInput) {
  const t = jobTotals(job, entries, expenses);
  const lines = [
    `${business.name ?? 'Invoice'} - Invoice #${number}`,
    `Job: ${job.title}`,
    job.client ? `Bill to: ${job.client}` : '',
    `Labor: ${t.hours} h × ${money(job.rate)} = ${money(t.labor)}`,
    `Parts and expenses: ${money(t.expenses)}`,
    `${job.status === 'paid' ? 'Total paid' : 'Total due'}: ${money(t.total)}`,
    job.status === 'paid' && job.checkNumber ? `Paid by check #${job.checkNumber}` : '',
  ].filter(Boolean);
  await Share.share({ message: lines.join('\n') });
}
