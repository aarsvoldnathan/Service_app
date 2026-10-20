import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { Button, Card, Field, Muted, SectionTitle } from '../components/ui';
import { money, parseMoney, shortDate } from '../dates';
import { jobTotals, taxPercent } from '../finance';
import { DAY_SHORT, dayIso, fmtHours, md, parseSpan, sameDay, weekDays, weekStart, weekText } from '../hours';
import { shareInvoicePdf, shareInvoiceText } from '../invoice';
import { useStore } from '../store';
import { font, Palette, radius, spacing, useStyles, useTheme } from '../theme';
import { Expense, Job } from '../types';

/**
 * Hours for the week, typed the way they're texted ("mon 8-6"). Each day adds to a running
 * invoice that can be sent at any time; after sending, the next hours start a new one.
 */
export function HoursPage() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const store = useStore();
  const { jobs, timeEntries, expenses, prefs, technicians, technicianName, setPrefs, saveJob, saveTimeEntry, deleteTimeEntry, activeFleet } = store;
  const me = prefs.meTechnicianId;
  const setup = prefs.hours ?? {};
  const lunch = setup.lunch ?? 0;
  const tax = taxPercent(prefs);

  const [start, setStart] = useState(() => weekStart(new Date()));
  const days = useMemo(() => weekDays(start), [start]);
  const [text, setText] = useState<Record<number, string>>({});
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [check, setCheck] = useState('');
  const [editExpense, setEditExpense] = useState<Expense | undefined>();

  const myJobs = jobs.filter((j) => j.weekly && j.technicianId === me);
  const myJobIds = new Set(myJobs.map((j) => j.id));
  const running = myJobs.find((j) => j.status === 'open');
  const sentWaiting = myJobs.filter((j) => j.status === 'invoiced');
  const entryFor = (d: Date) => timeEntries.find((e) => myJobIds.has(e.jobId) && sameDay(e.date, d));

  // Load the typed text for the week shown.
  const weekKey = start.toISOString();
  useEffect(() => {
    const t: Record<number, string> = {};
    days.forEach((d, i) => {
      const e = entryFor(d);
      if (e) t[i] = e.span ?? fmtHours(e.hours);
    });
    setText(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, timeEntries.length]);

  if (!me) {
    return (
      <View style={s.content}>
        <Muted>First choose who uses this phone, so your hours go on your invoice.</Muted>
        <Button title="Choose who I am" onPress={() => router.push('/settings/preferences')} />
      </View>
    );
  }

  const myName = technicianName(me);
  const rateNum = running?.rate ?? setup.rate ?? technicians.find((t) => t.id === me)?.hourlyRate ?? 0;

  /** The open running invoice, created the first time it's needed. */
  const ensureJob = (): Job => {
    if (running) return running;
    const draft = {
      title: `${myName} – hours`,
      client: setup.billTo || setup.bossName || undefined,
      clientContact: setup.bossPhone || undefined,
      technicianId: me,
      fleetId: activeFleet.id,
      rate: rateNum,
      weekly: true,
    };
    const { id } = saveJob(draft);
    return { ...draft, id: id!, status: 'open', createdAt: new Date().toISOString() } as Job;
  };

  const saveDay = (i: number) => {
    const d = days[i];
    const raw = text[i] ?? '';
    const existing = entryFor(d);
    const locked = existing && myJobs.find((j) => j.id === existing.jobId)?.status !== 'open';
    if (locked) return;
    const span = parseSpan(raw, lunch);
    if (!raw.trim()) {
      if (existing) deleteTimeEntry(existing.id);
      return;
    }
    if (!span) {
      Alert.alert(`${DAY_SHORT[i]} ${md(d)}`, 'Type the times like 8-6, 7:30-5 or 6a-2:30p, or just the hours (9).');
      return;
    }
    const job = ensureJob();
    const err = saveTimeEntry({
      id: existing?.id,
      jobId: job.id,
      technicianId: me,
      date: dayIso(d),
      hours: span.hours,
      span: span.text,
      note: [span.text, span.note].filter(Boolean).join(' · '),
    });
    if (err) Alert.alert('Hours', err);
    else setText((t) => ({ ...t, [i]: span.note ? `${span.text} ${span.note}` : span.text }));
  };

  const week = days.map((d, i) => {
    const e = entryFor(d);
    const typed = parseSpan(text[i] ?? '', lunch);
    return { day: d, text: e?.span ?? typed?.text, hours: e?.hours ?? typed?.hours ?? 0, locked: !!e && myJobs.find((j) => j.id === e.jobId)?.status !== 'open' };
  });
  const weekTotal = week.reduce((a, d) => a + d.hours, 0);

  const sendText = async () => {
    const body = weekText(week);
    const phone = setup.bossPhone?.replace(/[^\d+]/g, '');
    if (phone) {
      const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // fall back to the share sheet
      }
    }
    Share.share({ message: body });
  };

  const inv = running ? jobTotals(running, timeEntries, expenses) : { hours: 0, labor: 0, expenses: 0, total: 0 };
  const invEntries = running ? timeEntries.filter((e) => e.jobId === running.id) : [];
  const invExpenses = running ? expenses.filter((e) => e.jobId === running.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const since = invEntries.map((e) => e.date).sort()[0];

  const sendInvoice = (format: 'pdf' | 'text') => {
    if (!running || (!inv.hours && !inv.expenses)) return Alert.alert('Nothing to invoice yet', 'Enter some hours first.');
    Alert.alert(`Send invoice for ${money(inv.total)}?`, `${fmtHours(inv.hours)} h${inv.expenses ? ` + ${money(inv.expenses)} expenses` : ''}. Hours after this start a new invoice. Mark it paid when the check comes.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          const number = store.markInvoiced(running.id);
          const input = {
            job: { ...running, invoiceNumber: number },
            number,
            entries: timeEntries,
            expenses,
            business: prefs.business,
            technician: myName,
          };
          try {
            if (format === 'pdf') await shareInvoicePdf(input);
            else await shareInvoiceText(input);
          } catch (e) {
            Alert.alert('Invoice', String((e as Error).message ?? e));
          }
        },
      },
    ]);
  };

  const shift = (n: number) => setStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7));
  const isThisWeek = weekStart(new Date()).getTime() === start.getTime();
  const today = new Date();

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Week picker */}
      <View style={s.weekRow}>
        <Pressable onPress={() => shift(-1)} hitSlop={12} accessibilityLabel="Previous week" style={s.arrow}>
          <Text style={s.arrowText}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.weekTitle}>{isThisWeek ? 'This week' : `Week of ${md(start)}`}</Text>
          <Text style={s.weekSub}>
            {md(days[0])} – {md(days[6])}
          </Text>
        </View>
        <Pressable onPress={() => shift(1)} hitSlop={12} accessibilityLabel="Next week" style={s.arrow}>
          <Text style={s.arrowText}>›</Text>
        </Pressable>
      </View>

      {/* Days */}
      <View style={s.days}>
        {days.map((d, i) => {
          const w = week[i];
          const isToday = sameDay(today.toISOString(), d);
          return (
            <View key={i} style={[s.day, i > 0 && s.divider]}>
              <View style={s.dayLabel}>
                <Text style={[s.dayName, isToday && { color: c.accent }]}>{DAY_SHORT[i].toUpperCase()}</Text>
                <Text style={s.dayDate}>{md(d)}</Text>
              </View>
              <TextInput
                value={text[i] ?? ''}
                onChangeText={(v) => setText((t) => ({ ...t, [i]: v }))}
                onEndEditing={() => saveDay(i)}
                onSubmitEditing={() => saveDay(i)}
                placeholder={w.locked ? '' : 'off'}
                placeholderTextColor={c.border}
                editable={!w.locked}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                style={[s.input, w.locked && { color: c.muted }]}
                accessibilityLabel={`${DAY_SHORT[i]} hours, like 8-6`}
              />
              <Text style={[s.dayHours, !w.hours && { color: c.border }]}>{w.hours ? `${fmtHours(w.hours)} h` : '—'}</Text>
            </View>
          );
        })}
        <View style={[s.day, s.divider]}>
          <Text style={[s.dayName, { flex: 1 }]}>TOTAL</Text>
          <Text style={s.total}>{fmtHours(weekTotal)} h</Text>
        </View>
      </View>
      <Text style={s.hint}>Type times like 8-6 or 7:30-5{lunch ? ` (${fmtHours(lunch)} h lunch taken off each day)` : ''}. Locked days are already invoiced.</Text>

      <Button title={`💬  Text hours${setup.bossName ? ` to ${setup.bossName}` : ''}`} onPress={sendText} style={{ marginTop: spacing.md, minHeight: 56 }} />

      {/* Running invoice */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionTitle>Running invoice</SectionTitle>
        <Card>
          <View style={s.invRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.invAmount}>{money(inv.total)}</Text>
              <Text style={s.invSub}>
                {fmtHours(inv.hours)} h × {money(rateNum)}
                {inv.expenses ? ` + ${money(inv.expenses)} expenses` : ''}
                {since ? ` · since ${shortDate(since)}` : ''}
              </Text>
              <Text style={s.tax}>Set aside {tax}% for taxes: {money((inv.total * tax) / 100)}</Text>
            </View>
          </View>

          {invExpenses.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => {
                setEditExpense(e);
                setExpenseOpen(true);
              }}
              onLongPress={() =>
                Alert.alert('Delete expense?', `${e.description} · ${money(e.amount)}`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => store.deleteExpense(e.id) },
                ])
              }
              style={s.expRow}
            >
              {e.receiptUri ? <Image source={{ uri: e.receiptUri }} style={s.thumb} /> : <View style={[s.thumb, s.noThumb]} />}
              <Text style={s.expText} numberOfLines={1}>
                {e.description}
              </Text>
              <Text style={s.expAmount}>{money(e.amount)}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setEditExpense(undefined);
              setExpenseOpen(true);
            }}
            style={s.addExp}
            accessibilityRole="button"
          >
            <Text style={s.link}>+ Add expense</Text>
          </Pressable>

          {paying ? (
            <View style={{ marginTop: spacing.sm }}>
              <Field label="Check number" placeholder="e.g. 4521 (or cash)" value={check} onChangeText={setCheck} autoFocus />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setPaying(false)} />
                <Button
                  title="Paid"
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (!running) return;
                    const err = store.markPaid(running.id, check);
                    if (err) return Alert.alert('Got paid', err);
                    setPaying(false);
                    setCheck('');
                    Alert.alert('Paid ✓', 'Saved to your invoices. New hours start the next invoice.');
                  }}
                />
              </View>
            </View>
          ) : (
            <>
              <Button title="Send invoice" onPress={() => sendInvoice('pdf')} style={{ marginTop: spacing.sm }} />
              <Button title="Got the check" variant="secondary" onPress={() => (running && (inv.hours || inv.expenses) ? setPaying(true) : Alert.alert('Nothing to close yet', 'Enter some hours first.'))} style={{ marginTop: spacing.sm }} />
              <Pressable onPress={() => sendInvoice('text')} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
                <Text style={s.link}>Send invoice as a text instead</Text>
              </Pressable>
            </>
          )}
        </Card>
        {sentWaiting.map((j) => {
          const t = jobTotals(j, timeEntries, expenses);
          return (
            <Pressable key={j.id} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })} style={s.waiting}>
              <Text style={s.expText}>Invoice #{j.invoiceNumber} sent · waiting for check</Text>
              <Text style={s.expAmount}>{money(t.total)}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => router.push('/jobs')} hitSlop={8} style={{ marginTop: spacing.sm }}>
          <Text style={s.link}>Past invoices and earnings ›</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/settings/invoicing')} hitSlop={8} style={{ marginTop: spacing.lg }} accessibilityRole="button">
        <Text style={s.hint}>
          {[setup.bossName ? `Texts go to ${setup.bossName}` : 'Boss phone not set', `${money(rateNum)}/h`, setup.billTo && `bill to ${setup.billTo}`, lunch ? `${fmtHours(lunch)} h lunch` : '']
            .filter(Boolean)
            .join(' · ')}
          {'  '}
          <Text style={s.link}>⚙ Change</Text>
        </Text>
      </Pressable>

      <ExpenseSheet job={running ?? ensureJobPreview(me, myName, rateNum, activeFleet.id)} expense={editExpense} visible={expenseOpen} onClose={() => setExpenseOpen(false)} onBeforeSave={() => ensureJob()} />
    </ScrollView>
  );
}

/** Placeholder for the sheet before the running invoice exists (onBeforeSave makes the real one). */
function ensureJobPreview(me: string, name: string, rate: number, fleetId: string): Job {
  return { id: '', title: `${name} – hours`, technicianId: me, rate, fleetId, status: 'open', createdAt: new Date().toISOString(), weekly: true };
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 5 },
    weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: c.border },
    arrowText: { color: c.text, fontSize: 28, fontFamily: font.light, marginTop: -3 },
    weekTitle: { color: c.text, fontSize: 24, fontFamily: font.heading, letterSpacing: 0.5, textTransform: 'uppercase' },
    weekSub: { color: c.muted, fontSize: 13, fontFamily: font.light },
    days: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius, paddingHorizontal: spacing.md },
    day: { flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: spacing.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    dayLabel: { width: 56 },
    dayName: { color: c.text, fontSize: 18, fontFamily: font.heading, letterSpacing: 1 },
    dayDate: { color: c.muted, fontSize: 12, fontFamily: font.light },
    input: { flex: 1, color: c.text, fontSize: 20, fontFamily: font.regular, paddingVertical: spacing.sm },
    dayHours: { color: c.text, fontSize: 16, fontFamily: font.medium, minWidth: 54, textAlign: 'right' },
    total: { color: c.accent, fontSize: 22, fontFamily: font.headingBold },
    hint: { color: c.muted, fontSize: 12, fontFamily: font.light, marginTop: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontFamily: font.regular, marginBottom: spacing.xs },
    invRow: { flexDirection: 'row', alignItems: 'center' },
    invAmount: { color: c.accent, fontSize: 34, fontFamily: font.headingBold },
    invSub: { color: c.muted, fontSize: 13, fontFamily: font.light },
    expRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, marginTop: spacing.xs },
    thumb: { width: 32, height: 32, borderRadius: 6 },
    noThumb: { backgroundColor: c.border },
    expText: { color: c.text, fontSize: 15, fontFamily: font.regular, flex: 1 },
    expAmount: { color: c.text, fontSize: 15, fontFamily: font.medium },
    addExp: { paddingVertical: spacing.sm },
    link: { color: c.accent, fontSize: 14, fontFamily: font.medium },
    tax: { color: c.warn, fontSize: 14, fontFamily: font.medium, marginTop: 4 },
    waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: c.warn, borderRadius: radius },
  });
