import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, Field, Muted, SectionTitle } from '../../src/components/ui';
import { money, parseDate, parseMoney, shortDate, todayText } from '../../src/dates';
import { jobTotals } from '../../src/finance';
import { shareInvoicePdf, shareInvoiceText } from '../../src/invoice';
import { captureReceipt, deleteReceipt } from '../../src/receipts';
import { useCloud } from '../../src/cloud';
import { useStore } from '../../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';
import { Expense, TimeEntry } from '../../src/types';

const NONE = '__none';

export default function JobScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { isOwner } = useCloud();
  const { jobs, timeEntries, expenses, technicians, assets, prefs, technicianName } = store;
  const job = jobs.find((j) => j.id === id);

  // Add time
  const [tDate, setTDate] = useState(todayText());
  const [tHours, setTHours] = useState('');
  const [tNote, setTNote] = useState('');
  // Add expense
  const [eDate, setEDate] = useState(todayText());
  const [eAmount, setEAmount] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eReceipt, setEReceipt] = useState<string | undefined>();
  // Edit details / close
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
  const [busy, setBusy] = useState(false);

  if (!job) {
    return (
      <View style={s.content}>
        <Muted>Job not found.</Muted>
      </View>
    );
  }

  const time = timeEntries.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const exp = expenses.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const totals = jobTotals(job, timeEntries, expenses);
  const machine = assets.find((a) => a.id === job.assetId)?.name;
  const locked = job.status === 'paid';

  const addTime = () => {
    const date = parseDate(tDate);
    if (!date) return Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-19.');
    const error = store.saveTimeEntry({
      jobId: job.id,
      technicianId: job.technicianId,
      date,
      hours: Number(tHours.replace(',', '.')),
      note: tNote.trim() || undefined,
    });
    if (error) return Alert.alert('Cannot add time', error);
    setTHours('');
    setTNote('');
  };

  const addExpense = () => {
    const date = parseDate(eDate);
    if (!date) return Alert.alert('Check the date', 'Use YYYY-MM-DD, for example 2026-10-19.');
    const error = store.saveExpense({
      jobId: job.id,
      technicianId: job.technicianId,
      date,
      amount: parseMoney(eAmount),
      description: eDesc,
      receiptUri: eReceipt,
    });
    if (error) return Alert.alert('Cannot add expense', error);
    setEAmount('');
    setEDesc('');
    setEReceipt(undefined);
  };

  const attach = async (source: 'camera' | 'library') => {
    const uri = await captureReceipt(source);
    if (uri) setEReceipt(uri);
  };

  const removeTime = (e: TimeEntry) =>
    Alert.alert('Delete this time entry?', `${e.hours} h on ${shortDate(e.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => store.deleteTimeEntry(e.id) },
    ]);

  const removeExpense = (e: Expense) =>
    Alert.alert('Delete this expense?', `${e.description} · ${money(e.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteReceipt(e.receiptUri);
          store.deleteExpense(e.id);
        },
      },
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

  const invoiceInput = (number: number) => ({
    job: { ...job, invoiceNumber: number },
    number,
    entries: timeEntries,
    expenses,
    business: prefs.business,
    technician: job.technicianId ? technicianName(job.technicianId) : undefined,
    machine,
  });

  const sendInvoice = async (format: 'pdf' | 'text') => {
    if (!totals.hours && !exp.length) return Alert.alert('Nothing to invoice', 'Add hours or expenses first.');
    const number = store.markInvoiced(job.id);
    setBusy(true);
    try {
      if (format === 'pdf') await shareInvoicePdf(invoiceInput(number));
      else await shareInvoiceText(invoiceInput(number));
    } catch (e) {
      Alert.alert('Could not create the invoice', String(e));
    } finally {
      setBusy(false);
    }
  };

  const closeWithCheck = () => {
    const error = store.markPaid(job.id, check);
    if (error) return Alert.alert('Cannot close invoice', error);
    setClosing(false);
    setCheck('');
  };

  const removeJob = () =>
    Alert.alert(`Delete ${job.title}?`, 'All its hours, expenses and receipts are deleted. This cannot be undone.', [
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

  const statusColor = job.status === 'paid' ? c.ok : job.status === 'invoiced' ? c.warn : c.accent;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: job.invoiceNumber ? `Invoice #${job.invoiceNumber}` : 'Job' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Summary */}
        <View style={[s.banner, { borderColor: statusColor }]}>
          <Text style={s.title}>{job.title}</Text>
          <Text style={s.sub}>
            {[job.client, job.technicianId ? technicianName(job.technicianId) : undefined, machine, `${money(job.rate)}/h`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={[s.status, { color: statusColor }]}>
            {job.status === 'paid'
              ? `Paid${job.checkNumber ? ` · check #${job.checkNumber}` : ''}${job.paidAt ? ` · ${shortDate(job.paidAt)}` : ''}`
              : job.status === 'invoiced'
                ? `Invoice #${job.invoiceNumber} sent`
                : 'Open'}
          </Text>
          <View style={s.totals}>
            <View style={s.total}>
              <Text style={s.totalValue}>{totals.hours}</Text>
              <Text style={s.totalLabel}>Hours</Text>
            </View>
            <View style={s.total}>
              <Text style={s.totalValue}>{money(totals.labor)}</Text>
              <Text style={s.totalLabel}>Labor</Text>
            </View>
            <View style={s.total}>
              <Text style={s.totalValue}>{money(totals.expenses)}</Text>
              <Text style={s.totalLabel}>Expenses</Text>
            </View>
            <View style={s.total}>
              <Text style={[s.totalValue, { color: c.accent }]}>{money(totals.total)}</Text>
              <Text style={s.totalLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Invoice actions */}
        <View style={s.section}>
          <SectionTitle>Invoice</SectionTitle>
          <Button title={busy ? 'Making invoice…' : 'Share invoice (PDF)'} disabled={busy} onPress={() => sendInvoice('pdf')} />
          <Button title="Share as text message" variant="secondary" onPress={() => sendInvoice('text')} style={{ marginTop: spacing.sm }} />
          {job.status !== 'paid' ? (
            closing ? (
              <Card style={{ marginTop: spacing.sm }}>
                <Field label="Check number" placeholder="e.g. 4521 (or cash / card)" value={check} onChangeText={setCheck} autoFocus />
                <View style={s.two}>
                  <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setClosing(false)} />
                  <Button title="Close as paid" style={{ flex: 1 }} onPress={closeWithCheck} />
                </View>
              </Card>
            ) : (
              <Button title="Close invoice with check #" variant="secondary" onPress={() => setClosing(true)} style={{ marginTop: spacing.sm }} />
            )
          ) : (
            <Button title="Reopen job" variant="secondary" onPress={() => store.reopenJob(job.id)} style={{ marginTop: spacing.sm }} />
          )}
        </View>

        {/* Time */}
        <View style={s.section}>
          <SectionTitle>{`Hours (${totals.hours})`}</SectionTitle>
          {!locked && (
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={s.two}>
                <View style={{ flex: 1.3 }}>
                  <Field label="Date" value={tDate} onChangeText={setTDate} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Hours" placeholder="e.g. 7.5" value={tHours} onChangeText={setTHours} keyboardType="decimal-pad" />
                </View>
              </View>
              <Field label="What was done" placeholder="Optional" value={tNote} onChangeText={setTNote} />
              <Button title="Add hours" onPress={addTime} />
            </Card>
          )}
          {time.length === 0 ? <Muted>No hours logged yet.</Muted> : null}
          {time.map((e) => (
            <Pressable key={e.id} onLongPress={() => !locked && removeTime(e)} style={s.line} accessibilityHint="Hold to delete">
              <Text style={s.lineDate}>{shortDate(e.date)}</Text>
              <Text style={s.lineText} numberOfLines={2}>
                {e.note || 'Labor'}
              </Text>
              <Text style={s.lineAmount}>
                {e.hours} h · {money(e.hours * job.rate)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Expenses */}
        <View style={s.section}>
          <SectionTitle>{`Expenses (${money(totals.expenses)})`}</SectionTitle>
          {!locked && (
            <Card style={{ marginBottom: spacing.sm }}>
              <View style={s.two}>
                <View style={{ flex: 1.3 }}>
                  <Field label="Date" value={eDate} onChangeText={setEDate} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Amount ($)" placeholder="0.00" value={eAmount} onChangeText={setEAmount} keyboardType="decimal-pad" />
                </View>
              </View>
              <Field label="What for" placeholder="e.g. Hydraulic hose, fuel" value={eDesc} onChangeText={setEDesc} />
              {eReceipt ? (
                <View style={s.receiptRow}>
                  <Image source={{ uri: eReceipt }} style={s.thumb} />
                  <Text style={s.lineText}>Receipt attached</Text>
                  <Button title="Remove" variant="danger" onPress={() => setEReceipt(undefined)} />
                </View>
              ) : (
                <View style={[s.two, { marginBottom: spacing.sm }]}>
                  <Button title="📷 Scan receipt" variant="secondary" style={{ flex: 1 }} onPress={() => attach('camera')} />
                  <Button title="From photos" variant="secondary" style={{ flex: 1 }} onPress={() => attach('library')} />
                </View>
              )}
              <Button title="Add expense" onPress={addExpense} />
            </Card>
          )}
          {exp.length === 0 ? <Muted>No expenses yet.</Muted> : null}
          {exp.map((e) => (
            <Pressable key={e.id} onLongPress={() => !locked && removeExpense(e)} style={s.line} accessibilityHint="Hold to delete">
              {e.receiptUri ? (
                <Pressable onPress={() => setViewReceipt(e.receiptUri)} accessibilityLabel="View receipt">
                  <Image source={{ uri: e.receiptUri }} style={s.thumbSmall} />
                </Pressable>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={s.lineText}>{e.description}</Text>
                <Text style={s.lineDate}>{shortDate(e.date)}</Text>
              </View>
              <Text style={s.lineAmount}>{money(e.amount)}</Text>
            </Pressable>
          ))}
          {(time.length > 0 || exp.length > 0) && !locked ? <Text style={s.hint}>Hold an entry to delete it.</Text> : null}
        </View>

        {/* Details */}
        <View style={s.section}>
          <SectionTitle>Job details</SectionTitle>
          {editing ? (
            <Card>
              <Field label="Job name" value={title} onChangeText={setTitle} />
              <Field label="Bill to" value={client} onChangeText={setClient} />
              <Field label="Customer phone / email" value={contact} onChangeText={setContact} autoCapitalize="none" />
              {isOwner ? (
                <>
                  <Text style={s.label}>Who is working</Text>
                  <ChipSelect
                    options={[...technicians.map((t) => ({ value: t.id, label: t.name })), { value: NONE, label: 'Not set' }]}
                    value={techId}
                    onChange={setTechId}
                  />
                  <View style={{ height: spacing.md }} />
                </>
              ) : null}
              <Field label="Hourly rate ($)" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
              <Field label="Invoice notes" placeholder="Payment terms, thank-you note" value={notes} onChangeText={setNotes} multiline />
              <View style={s.two}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)} />
                <Button title="Save" style={{ flex: 1 }} onPress={saveDetails} />
              </View>
            </Card>
          ) : (
            <Button title="Edit job details" variant="secondary" onPress={() => setEditing(true)} />
          )}
          <Button title="Delete job" variant="danger" onPress={removeJob} style={{ marginTop: spacing.sm }} />
        </View>
      </ScrollView>

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
    banner: { borderWidth: 2, borderRadius: radius, padding: spacing.md, backgroundColor: c.card, marginBottom: spacing.lg },
    title: { color: c.text, fontSize: 22, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 14, marginTop: 2 },
    status: { fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
    totals: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.xs },
    total: { flex: 1, alignItems: 'center' },
    totalValue: { color: c.text, fontSize: 16, fontWeight: '800' },
    totalLabel: { color: c.muted, fontSize: 11, marginTop: 2 },
    section: { marginBottom: spacing.lg },
    two: { flexDirection: 'row', gap: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      marginBottom: spacing.xs,
      minHeight: 52,
    },
    lineDate: { color: c.muted, fontSize: 13, minWidth: 90 },
    lineText: { color: c.text, fontSize: 15, flex: 1 },
    lineAmount: { color: c.text, fontSize: 15, fontWeight: '800' },
    receiptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    thumb: { width: 56, height: 56, borderRadius: 8 },
    thumbSmall: { width: 40, height: 40, borderRadius: 6 },
    hint: { color: c.muted, fontSize: 12, marginTop: spacing.xs },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
    full: { width: '100%', height: '85%' },
    viewerHint: { color: '#fff', marginTop: spacing.md },
  });
