import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCloud } from '../../src/cloud';
import { ExpenseSheet } from '../../src/components/ExpenseSheet';
import { useNow } from '../../src/components/Social';
import { Button, Card, ChipSelect, Field, HeaderButton, Muted } from '../../src/components/ui';
import { money, parseDate, parseMoney, shortDate, todayText } from '../../src/dates';
import { clockText, liveTotals } from '../../src/finance';
import { shareInvoicePdf, shareInvoiceText } from '../../src/invoice';
import { sendInvoice } from '../../src/invoiceFlow';
import { deleteReceipt } from '../../src/receipts';
import { useStore } from '../../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';
import { Expense, TimeEntry } from '../../src/types';

const NONE = '__none';
const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** One job as a running time clock: start/stop, send the invoice any time, expenses below. */
export default function JobScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { isOwner } = useCloud();
  const { jobs, timeEntries, expenses, technicians, assets, prefs, technicianName } = store;
  const job = jobs.find((j) => j.id === id);
  const now = useNow(1000);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | undefined>();
  const [manual, setManual] = useState(false);
  const [tDate, setTDate] = useState(todayText());
  const [tHours, setTHours] = useState('');
  const [tNote, setTNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(job?.title ?? '');
  const [client, setClient] = useState(job?.client ?? '');
  const [contact, setContact] = useState(job?.clientContact ?? '');
  const [rate, setRate] = useState(String(job?.rate ?? ''));
  const [techId, setTechId] = useState<string>(job?.technicianId ?? NONE);
  const [notes, setNotes] = useState(job?.notes ?? '');
  const [closing, setClosing] = useState(false);
  const [check, setCheck] = useState('');
  const [viewReceipt, setViewReceipt] = useState<string | undefined>();

  if (!job) {
    return (
      <View style={s.content}>
        <Muted>Job not found.</Muted>
      </View>
    );
  }

  const time = timeEntries.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const exp = expenses.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const t = liveTotals(job, timeEntries, expenses, now);
  const running = !!job.clockStartedAt;
  const isOpen = job.status === 'open';
  const machine = assets.find((a) => a.id === job.assetId)?.name;
  const statusColor = job.status === 'paid' ? c.ok : job.status === 'invoiced' ? c.warn : running ? c.danger : c.accent;

  const invoice = (format: 'pdf' | 'text') =>
    sendInvoice(store, job, format, (r) => r.nextId && router.replace({ pathname: '/jobs/[id]', params: { id: r.nextId } }));

  const toggleClock = () => (running ? store.clockOut(job.id) : store.clockIn(job.id));

  const addManual = () => {
    const date = parseDate(tDate);
    if (!date) return Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-19.');
    const error = store.saveTimeEntry({ jobId: job.id, technicianId: job.technicianId, date, hours: Number(tHours.replace(',', '.')), note: tNote.trim() || undefined });
    if (error) return Alert.alert('Add time', error);
    setTHours('');
    setTNote('');
    setManual(false);
  };

  const removeTime = (e: TimeEntry) =>
    Alert.alert('Delete this time?', `${e.hours} h on ${shortDate(e.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => store.deleteTimeEntry(e.id) },
    ]);

  const expenseMenu = (e: Expense) =>
    Alert.alert(e.description, money(e.amount), [
      { text: 'Cancel', style: 'cancel' },
      ...(e.receiptUri ? [{ text: 'View receipt', onPress: () => setViewReceipt(e.receiptUri) }] : []),
      ...(isOpen ? [{ text: 'Edit', onPress: () => { setEditExpense(e); setExpenseOpen(true); } }] : []),
      ...(isOpen
        ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => { deleteReceipt(e.receiptUri); store.deleteExpense(e.id); } }]
        : []),
    ]);

  const saveDetails = () => {
    const { error } = store.saveJob({
      ...job,
      title,
      client: client.trim() || undefined,
      clientContact: contact.trim() || undefined,
      rate: parseMoney(rate || '0'),
      technicianId: techId === NONE ? undefined : techId,
      notes: notes.trim() || undefined,
    });
    if (error) Alert.alert('Cannot save', error);
    else setEditing(false);
  };

  const resend = (format: 'pdf' | 'text') => {
    const input = {
      job,
      number: job.invoiceNumber ?? 0,
      entries: timeEntries,
      expenses,
      business: prefs.business,
      technician: job.technicianId ? technicianName(job.technicianId) : undefined,
      machine,
    };
    (format === 'pdf' ? shareInvoicePdf(input) : shareInvoiceText(input)).catch((e) => Alert.alert('Invoice', String(e)));
  };

  const removeJob = () =>
    Alert.alert(`Delete ${job.title}?`, 'All its time, expenses and receipts are deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          exp.forEach((e) => deleteReceipt(e.receiptUri));
          store.deleteJob(job.id);
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          title: job.invoiceNumber ? `Invoice #${job.invoiceNumber}` : 'Time clock',
          headerRight: () => <HeaderButton title={editing ? 'Done' : 'Edit'} label="Edit job details" onPress={() => setEditing((v) => !v)} />,
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{job.title}</Text>
        <Text style={s.sub}>{[job.client, job.technicianId ? technicianName(job.technicianId) : undefined, machine, `${money(job.rate)}/h`].filter(Boolean).join(' · ')}</Text>

        {editing ? (
          <Card style={{ marginTop: spacing.md }}>
            <Field label="Job name" value={title} onChangeText={setTitle} />
            <Field label="Bill to" value={client} onChangeText={setClient} />
            <Field label="Customer phone / email" value={contact} onChangeText={setContact} autoCapitalize="none" />
            {isOwner ? (
              <>
                <Text style={s.label}>Who is working</Text>
                <ChipSelect
                  options={[...technicians.filter((x) => store.activeFleet.memberIds.includes(x.id)).map((x) => ({ value: x.id, label: x.name })), { value: NONE, label: 'Not set' }]}
                  value={techId}
                  onChange={setTechId}
                />
                <View style={{ height: spacing.md }} />
              </>
            ) : null}
            <Field label="Hourly rate ($)" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
            <Field label="Invoice notes" placeholder="Payment terms, thank-you note" value={notes} onChangeText={setNotes} multiline />
            <Button title="Save" onPress={saveDetails} />
            <Button title="Delete job" variant="danger" onPress={removeJob} style={{ marginTop: spacing.sm }} />
          </Card>
        ) : null}

        {/* The clock */}
        <View style={[s.clockCard, { borderColor: statusColor }]}>
          <Text style={[s.state, { color: statusColor }]}>
            {job.status === 'paid'
              ? `PAID${job.checkNumber ? ` · CHECK #${job.checkNumber}` : ''}`
              : job.status === 'invoiced'
                ? `INVOICE #${job.invoiceNumber} SENT · ${job.invoicedAt ? shortDate(job.invoicedAt) : ''}`
                : running
                  ? `ON THE CLOCK SINCE ${timeOfDay(job.clockStartedAt!)}`
                  : 'CLOCK STOPPED'}
          </Text>
          <Text style={s.bigTime}>{running ? clockText(t.running) : clockText(t.hours)}</Text>
          <Text style={s.bigCaption}>{running ? `this session · ${t.hours.toFixed(2)} h total` : 'total time'}</Text>
          <Text style={s.amount}>{money(t.total)}</Text>
          <Text style={s.amountCaption}>
            {money(t.labor)} labor{t.expenses ? ` + ${money(t.expenses)} expenses` : ''}
          </Text>

          {isOpen ? (
            <>
              <Pressable
                onPress={toggleClock}
                style={[s.startStop, { backgroundColor: running ? c.danger : c.ok }]}
                accessibilityRole="button"
                accessibilityLabel={running ? 'Stop the clock' : 'Start the clock'}
              >
                <Text style={s.startStopText}>{running ? '■  Stop' : '▶  Start'}</Text>
              </Pressable>
              <Button title="Send invoice" variant="secondary" onPress={() => invoice('pdf')} style={{ marginTop: spacing.sm, alignSelf: 'stretch' }} />
              <Pressable onPress={() => invoice('text')} hitSlop={8} style={{ marginTop: spacing.sm }}>
                <Text style={s.link}>Send as a text message instead</Text>
              </Pressable>
            </>
          ) : job.status === 'invoiced' ? (
            closing ? (
              <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
                <Field label="Paid by check #" placeholder="e.g. 4521 (or cash / card)" value={check} onChangeText={setCheck} autoFocus />
                <View style={s.two}>
                  <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setClosing(false)} />
                  <Button
                    title="Mark paid"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const err = store.markPaid(job.id, check);
                      if (err) Alert.alert('Mark paid', err);
                      else setClosing(false);
                    }}
                  />
                </View>
              </View>
            ) : (
              <>
                <Button title="Mark paid" onPress={() => setClosing(true)} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
                <Button title="Share invoice again" variant="secondary" onPress={() => resend('pdf')} style={{ marginTop: spacing.sm, alignSelf: 'stretch' }} />
                <Pressable onPress={() => store.reopenJob(job.id)} hitSlop={8} style={{ marginTop: spacing.sm }}>
                  <Text style={s.link}>Reopen to add more time</Text>
                </Pressable>
              </>
            )
          ) : (
            <>
              <Button title="Share invoice again" variant="secondary" onPress={() => resend('pdf')} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
              <Pressable onPress={() => store.reopenJob(job.id)} hitSlop={8} style={{ marginTop: spacing.sm }}>
                <Text style={s.link}>Reopen</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Expenses */}
        <View style={s.headRow}>
          <Text style={s.section}>Expenses</Text>
          <Text style={s.sectionTotal}>{money(t.expenses)}</Text>
        </View>
        {exp.map((e) => (
          <Pressable key={e.id} onPress={() => expenseMenu(e)} style={s.row} accessibilityRole="button">
            {e.receiptUri ? <Image source={{ uri: e.receiptUri }} style={s.thumb} /> : <View style={[s.thumb, s.noThumb]}><Text style={s.noThumbText}>$</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>
                {e.description}
              </Text>
              <Text style={s.rowMeta}>{shortDate(e.date)}{e.receiptUri ? ' · receipt' : ''}</Text>
            </View>
            <Text style={s.rowAmount}>{money(e.amount)}</Text>
          </Pressable>
        ))}
        {isOpen ? (
          <Pressable onPress={() => { setEditExpense(undefined); setExpenseOpen(true); }} style={s.addRow} accessibilityRole="button">
            <Text style={s.addText}>+ Add expense</Text>
          </Pressable>
        ) : !exp.length ? (
          <Muted>No expenses.</Muted>
        ) : null}

        {/* Time log */}
        <View style={s.headRow}>
          <Text style={s.section}>Time</Text>
          <Text style={s.sectionTotal}>{t.hours.toFixed(2)} h</Text>
        </View>
        {running ? (
          <View style={s.row}>
            <View style={s.liveDot} />
            <Text style={[s.rowTitle, { flex: 1 }]}>Running since {timeOfDay(job.clockStartedAt!)}</Text>
            <Text style={s.rowAmount}>{clockText(t.running)}</Text>
          </View>
        ) : null}
        {time.map((e) => (
          <Pressable key={e.id} onLongPress={() => isOpen && removeTime(e)} style={s.row} accessibilityHint="Hold to delete">
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{shortDate(e.date)}{e.note ? ` · ${e.note}` : ''}</Text>
              <Text style={s.rowMeta}>{money(e.hours * job.rate)}</Text>
            </View>
            <Text style={s.rowAmount}>{e.hours.toFixed(2)} h</Text>
          </Pressable>
        ))}
        {isOpen ? (
          manual ? (
            <Card style={{ marginTop: spacing.sm }}>
              <View style={s.two}>
                <View style={{ flex: 1.3 }}>
                  <Field label="Date" value={tDate} onChangeText={setTDate} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Hours" placeholder="7.5" value={tHours} onChangeText={setTHours} keyboardType="decimal-pad" />
                </View>
              </View>
              <Field label="Note" placeholder="Optional" value={tNote} onChangeText={setTNote} />
              <View style={s.two}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setManual(false)} />
                <Button title="Add time" style={{ flex: 1 }} onPress={addManual} />
              </View>
            </Card>
          ) : (
            <Pressable onPress={() => setManual(true)} style={s.addRow} accessibilityRole="button">
              <Text style={s.addText}>+ Add time by hand</Text>
            </Pressable>
          )
        ) : null}
        {time.length ? <Text style={s.hint}>Hold a time entry to delete it.</Text> : null}
      </ScrollView>

      <ExpenseSheet job={job} expense={editExpense} visible={expenseOpen} onClose={() => setExpenseOpen(false)} />

      <Modal visible={!!viewReceipt} transparent animationType="fade" onRequestClose={() => setViewReceipt(undefined)}>
        <Pressable style={s.viewer} onPress={() => setViewReceipt(undefined)} accessibilityLabel="Close receipt">
          {viewReceipt ? <Image source={{ uri: viewReceipt }} style={s.full} resizeMode="contain" /> : null}
          <Text style={s.viewerHint}>Tap to close</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    title: { color: c.text, fontSize: 24, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 14, marginTop: 2 },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    two: { flexDirection: 'row', gap: spacing.sm },
    clockCard: { alignItems: 'center', borderWidth: 2, borderRadius: 20, padding: spacing.lg, marginVertical: spacing.lg, backgroundColor: c.card },
    state: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    bigTime: { color: c.text, fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: spacing.sm },
    bigCaption: { color: c.muted, fontSize: 13 },
    amount: { color: c.accent, fontSize: 32, fontWeight: '800', marginTop: spacing.md },
    amountCaption: { color: c.muted, fontSize: 13 },
    startStop: { marginTop: spacing.lg, alignSelf: 'stretch', minHeight: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    startStopText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    link: { color: c.accent, fontSize: 14, fontWeight: '700' },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.md, marginBottom: spacing.xs },
    section: { color: c.text, fontSize: 18, fontWeight: '800' },
    sectionTotal: { color: c.muted, fontSize: 15, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      minHeight: 56,
    },
    rowTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowMeta: { color: c.muted, fontSize: 13, marginTop: 1 },
    rowAmount: { color: c.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
    thumb: { width: 40, height: 40, borderRadius: 8 },
    noThumb: { backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
    noThumbText: { color: c.muted, fontWeight: '800' },
    liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, marginHorizontal: 15 },
    addRow: { paddingVertical: spacing.md },
    addText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    hint: { color: c.muted, fontSize: 12, marginTop: spacing.xs },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    full: { width: '100%', height: '85%' },
    viewerHint: { color: '#fff', marginTop: spacing.md },
  });
