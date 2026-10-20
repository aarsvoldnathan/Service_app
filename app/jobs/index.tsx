import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../../src/components/BarChart';
import { Button, Card, ChipSelect, Field, ListRow, Muted, SectionTitle } from '../../src/components/ui';
import { money, parseMoney, shortDate } from '../../src/dates';
import { useNow } from '../../src/components/Social';
import { buckets, clockText, jobTotals, liveTotals, Period, PERIOD_LABEL } from '../../src/finance';
import { sendInvoice } from '../../src/invoiceFlow';
import { useCloud } from '../../src/cloud';
import { useStore } from '../../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';

type Tab = 'jobs' | 'earnings';
const ALL = '__all';
const NONE = '__none';


export default function JobsScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const store = useStore();
  const { jobs, timeEntries, expenses, technicians: allTechs, prefs, saveJob, technicianName, activeFleet, clockIn, clockOut } = store;
  const { isOwner } = useCloud();
  // Only the owner can bill for or see other people. Everyone else works with their own profile.
  const technicians = isOwner
    ? allTechs.filter((t) => activeFleet.memberIds.includes(t.id))
    : allTechs.filter((t) => t.id === prefs.meTechnicianId);
  const [tab, setTab] = useState<Tab>('jobs');

  // New job form
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [techId, setTechId] = useState<string>(prefs.meTechnicianId ?? NONE);
  const [rate, setRate] = useState(String(technicians.find((t) => t.id === prefs.meTechnicianId)?.hourlyRate ?? ''));
  const [showPaid, setShowPaid] = useState(false);
  const now = useNow(1000);

  // Earnings
  const [period, setPeriod] = useState<Period>('week');
  const [who, setWho] = useState<string>(isOwner ? ALL : prefs.meTechnicianId ?? ALL);

  const pickTech = (id: string) => {
    setTechId(id);
    const r = technicians.find((t) => t.id === id)?.hourlyRate;
    if (r !== undefined) setRate(String(r));
  };

  const create = (start: boolean) => {
    const r = parseMoney(rate || '0');
    const { error, id } = saveJob({
      title,
      client: client.trim() || undefined,
      technicianId: isOwner ? (techId === NONE ? undefined : techId) : prefs.meTechnicianId,
      fleetId: activeFleet.id,
      rate: r,
      clockStartedAt: start ? new Date().toISOString() : undefined,
    });
    if (error || !id) {
      Alert.alert('Cannot create job', error ?? '');
      return;
    }
    setAdding(false);
    setTitle('');
    setClient('');
    router.push({ pathname: '/jobs/[id]', params: { id } });
  };

  const sorted = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Running clocks first, then the other open jobs.
  const active = sorted.filter((j) => j.status === 'open').sort((a, b) => Number(!!b.clockStartedAt) - Number(!!a.clockStartedAt));
  const sent = sorted.filter((j) => j.status === 'invoiced');
  const paid = sorted.filter((j) => j.status === 'paid');

  const data = buckets(period, jobs, timeEntries, expenses, who === ALL ? undefined : who);
  const cur = data[data.length - 1];
  const sum = data.reduce((a, b) => ({ income: a.income + b.income, expenses: a.expenses + b.expenses, hours: a.hours + b.hours }), {
    income: 0,
    expenses: 0,
    hours: 0,
  });
  const unpaid = jobs
    .filter((j) => j.status !== 'paid' && (who === ALL || j.technicianId === who))
    .reduce((a, j) => a + jobTotals(j, timeEntries, expenses).total, 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: tab === 'jobs' ? 'Time clock' : 'Earnings' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: spacing.lg }}>
          <ChipSelect
            options={[
              { value: 'jobs', label: 'Time clock' },
              { value: 'earnings', label: 'Earnings' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'jobs' ? (
          <>
            {active.map((j) => {
              const t = liveTotals(j, timeEntries, expenses, now);
              const running = !!j.clockStartedAt;
              return (
                <Pressable
                  key={j.id}
                  onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })}
                  style={[s.clock, running && { borderColor: c.danger }]}
                  accessibilityRole="button"
                >
                  <View style={s.clockTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.clockTitle} numberOfLines={1}>
                        {j.title}
                      </Text>
                      <Text style={s.clockMeta} numberOfLines={1}>
                        {[j.client, isOwner && j.technicianId ? technicianName(j.technicianId) : undefined, `${money(j.rate)}/h`].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => (running ? clockOut(j.id) : clockIn(j.id))}
                      style={[s.play, { backgroundColor: running ? c.danger : c.ok }]}
                      accessibilityRole="button"
                      accessibilityLabel={running ? 'Stop the clock' : 'Start the clock'}
                      hitSlop={6}
                    >
                      <Text style={s.playText}>{running ? '■' : '▶'}</Text>
                    </Pressable>
                  </View>
                  <View style={s.clockBottom}>
                    <View>
                      <Text style={[s.clockTime, running && { color: c.danger }]}>{running ? clockText(t.running) : `${t.hours.toFixed(2)} h`}</Text>
                      <Text style={s.clockMeta}>{running ? `running · ${t.hours.toFixed(2)} h total` : t.expenses ? `incl. ${money(t.expenses)} expenses` : 'stopped'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.clockAmount}>{money(t.total)}</Text>
                      <Pressable onPress={() => sendInvoice(store, j, 'pdf')} hitSlop={8} accessibilityRole="button">
                        <Text style={s.link}>Send invoice ›</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {adding ? (
              <Card style={{ marginBottom: spacing.lg }}>
                <Field label="Job or customer" placeholder="e.g. Smith driveway" value={title} onChangeText={setTitle} autoFocus />
                <Field label="Bill to (optional)" placeholder="Customer or company" value={client} onChangeText={setClient} />
                <Field label="Hourly rate ($)" keyboardType="decimal-pad" placeholder="e.g. 85" value={rate} onChangeText={setRate} />
                {isOwner && technicians.length > 1 ? (
                  <>
                    <Text style={s.label}>Who is working</Text>
                    <ChipSelect options={technicians.map((t) => ({ value: t.id, label: t.name }))} value={techId} onChange={pickTech} />
                    <View style={{ height: spacing.md }} />
                  </>
                ) : null}
                <View style={s.two}>
                  <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
                  <Button title="▶ Start clock" style={{ flex: 1 }} onPress={() => create(true)} />
                </View>
                <Pressable onPress={() => create(false)} hitSlop={8} style={{ marginTop: spacing.sm, alignSelf: 'center' }}>
                  <Text style={s.link}>Create without starting</Text>
                </Pressable>
              </Card>
            ) : (
              <Pressable onPress={() => setAdding(true)} style={s.newJob} accessibilityRole="button">
                <Text style={s.newJobText}>+ New job</Text>
              </Pressable>
            )}

            {!jobs.length && !adding ? <Muted>Tap + New job, then Start. Send the invoice whenever you're ready — the clock can keep running.</Muted> : null}

            {sent.length ? (
              <>
                <Text style={s.group}>Waiting for payment</Text>
                {sent.map((j) => (
                  <ListRow
                    key={j.id}
                    title={j.title}
                    subtitle={[j.client, `#${j.invoiceNumber}`, j.invoicedAt ? shortDate(j.invoicedAt) : undefined].filter(Boolean).join(' · ')}
                    right={money(jobTotals(j, timeEntries, expenses).total)}
                    dot={c.warn}
                    onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })}
                  />
                ))}
              </>
            ) : null}
            {paid.length ? (
              <>
                <Pressable onPress={() => setShowPaid((v) => !v)} hitSlop={8}>
                  <Text style={s.group}>
                    Paid ({paid.length}) {showPaid ? '▲' : '▼'}
                  </Text>
                </Pressable>
                {showPaid
                  ? paid.map((j) => (
                      <ListRow
                        key={j.id}
                        title={j.title}
                        subtitle={[j.client, `#${j.invoiceNumber}`, j.checkNumber ? `check ${j.checkNumber}` : undefined].filter(Boolean).join(' · ')}
                        right={money(jobTotals(j, timeEntries, expenses).total)}
                        dot={c.ok}
                        onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })}
                      />
                    ))
                  : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            {isOwner ? (
              <>
                <Text style={s.label}>Person</Text>
                <ChipSelect
                  options={[{ value: ALL, label: 'Everyone' }, ...technicians.map((t) => ({ value: t.id, label: t.name }))]}
                  value={who}
                  onChange={setWho}
                />
                <View style={{ height: spacing.md }} />
              </>
            ) : (
              <Text style={s.label}>Your hours, income and expenses. Only you and the fleet owner can see these.</Text>
            )}
            <ChipSelect
              options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              value={period}
              onChange={(v) => setPeriod(v as Period)}
            />

            <View style={[s.tiles, { marginTop: spacing.lg }]}>
              <View style={s.tile}>
                <Text style={[s.tileValue, { color: c.ok }]}>{money(cur.income)}</Text>
                <Text style={s.tileLabel}>Income this {period}</Text>
              </View>
              <View style={s.tile}>
                <Text style={[s.tileValue, { color: c.danger }]}>{money(cur.expenses)}</Text>
                <Text style={s.tileLabel}>Expenses this {period}</Text>
              </View>
              <View style={s.tile}>
                <Text style={s.tileValue}>{cur.hours}</Text>
                <Text style={s.tileLabel}>Hours this {period}</Text>
              </View>
            </View>

            <Card style={{ marginTop: spacing.md }}>
              <BarChart data={data} />
            </Card>

            <Card style={{ marginTop: spacing.md }}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 1.2 }]}>{PERIOD_LABEL[period].replace('ly', '').replace('Annual', 'Year')}</Text>
                <Text style={[s.th, s.r]}>Hours</Text>
                <Text style={[s.th, s.r]}>Income</Text>
                <Text style={[s.th, s.r]}>Expenses</Text>
                <Text style={[s.th, s.r]}>Net</Text>
              </View>
              {[...data].reverse().map((b) => (
                <View key={b.start.toISOString()} style={s.tr}>
                  <Text style={[s.td, { flex: 1.2 }]}>{b.label}</Text>
                  <Text style={[s.td, s.r]}>{b.hours}</Text>
                  <Text style={[s.td, s.r]}>{money(b.income)}</Text>
                  <Text style={[s.td, s.r]}>{money(b.expenses)}</Text>
                  <Text style={[s.td, s.r, { color: b.income - b.expenses < 0 ? c.danger : c.text }]}>{money(b.income - b.expenses)}</Text>
                </View>
              ))}
              <View style={[s.tr, { borderBottomWidth: 0 }]}>
                <Text style={[s.td, s.bold, { flex: 1.2 }]}>Total</Text>
                <Text style={[s.td, s.r, s.bold]}>{sum.hours}</Text>
                <Text style={[s.td, s.r, s.bold]}>{money(sum.income)}</Text>
                <Text style={[s.td, s.r, s.bold]}>{money(sum.expenses)}</Text>
                <Text style={[s.td, s.r, s.bold]}>{money(sum.income - sum.expenses)}</Text>
              </View>
            </Card>
            <Text style={s.note}>
              Income = hours × the job's hourly rate. Expenses = costs entered on jobs. Not yet paid: {money(unpaid)}.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    two: { flexDirection: 'row', gap: spacing.sm },
    tiles: { flexDirection: 'row', gap: spacing.sm },
    tile: { flex: 1, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius, padding: spacing.sm, alignItems: 'center' },
    tileValue: { color: c.text, fontSize: 18, fontWeight: '800' },
    tileLabel: { color: c.muted, fontSize: 11, textAlign: 'center', marginTop: 2 },
    tableHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: c.text, paddingBottom: 4 },
    th: { flex: 1, color: c.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
    td: { flex: 1, color: c.text, fontSize: 13 },
    r: { textAlign: 'right' },
    bold: { fontWeight: '800' },
    note: { color: c.muted, fontSize: 12, marginTop: spacing.md },
    clock: { borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: c.card },
    clockTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    clockTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    clockMeta: { color: c.muted, fontSize: 13, marginTop: 2 },
    play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    playText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    clockBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.md },
    clockTime: { color: c.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
    clockAmount: { color: c.accent, fontSize: 22, fontWeight: '800' },
    link: { color: c.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
    newJob: { borderWidth: 1, borderStyle: 'dashed', borderColor: c.muted, borderRadius: 16, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
    newJobText: { color: c.text, fontSize: 16, fontWeight: '700' },
    group: { color: c.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },
  });
