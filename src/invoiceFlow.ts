// "Send invoice" at any moment, even with the clock running.
import { Alert } from 'react-native';
import { money } from './dates';
import { liveTotals } from './finance';
import { shareInvoicePdf, shareInvoiceText } from './invoice';
import type { useStore } from './store';
import { Job, TimeEntry } from './types';

type Store = ReturnType<typeof useStore>;

async function send(store: Store, job: Job, format: 'pdf' | 'text', keepRunning: boolean) {
  const entries: TimeEntry[] = [...store.timeEntries];
  if (job.clockStartedAt) {
    const start = job.clockStartedAt;
    const hours = store.clockOut(job.id);
    // The store saves the entry on the next render; include it in this invoice now.
    if (hours) entries.push({ id: 'running', jobId: job.id, technicianId: job.technicianId, date: start, hours });
  }
  const number = store.markInvoiced(job.id);
  let nextId: string | undefined;
  if (keepRunning) {
    // The clock carries on in a new period for the same customer.
    nextId = store.saveJob({
      title: job.title,
      client: job.client,
      clientContact: job.clientContact,
      technicianId: job.technicianId,
      assetId: job.assetId,
      fleetId: job.fleetId,
      rate: job.rate,
      notes: job.notes,
      clockStartedAt: new Date().toISOString(),
    }).id;
  }
  const input = {
    job: { ...job, clockStartedAt: undefined, invoiceNumber: number },
    number,
    entries,
    expenses: store.expenses,
    business: store.prefs.business,
    technician: job.technicianId ? store.technicianName(job.technicianId) : undefined,
    machine: store.assets.find((a) => a.id === job.assetId)?.name,
  };
  if (format === 'pdf') await shareInvoicePdf(input);
  else await shareInvoiceText(input);
  return { number, nextId };
}

/** Ask, then stop/keep the clock, number the invoice and open the share sheet. */
export function sendInvoice(store: Store, job: Job, format: 'pdf' | 'text' = 'pdf', onDone?: (r: { number: number; nextId?: string }) => void) {
  const t = liveTotals(job, store.timeEntries, store.expenses);
  if (t.hours < 0.02 && !t.expenses) {
    Alert.alert('Nothing to invoice yet', 'Start the clock or add an expense first.');
    return;
  }
  const run = (keep: boolean) =>
    send(store, job, format, keep)
      .then((r) => onDone?.(r))
      .catch((e) => Alert.alert('Could not make the invoice', String((e as Error).message ?? e)));
  const summary = `${t.hours.toFixed(2)} h + ${money(t.expenses)} expenses = ${money(t.total)}`;
  if (job.clockStartedAt) {
    Alert.alert(`Send invoice for ${money(t.total)}?`, `${summary}\n\nThe clock is running.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send & keep clock running', onPress: () => run(true) },
      { text: 'Send & stop clock', onPress: () => run(false) },
    ]);
  } else {
    Alert.alert(`Send invoice for ${money(t.total)}?`, summary, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => run(false) },
    ]);
  }
}
