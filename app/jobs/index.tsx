import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../../src/components/BarChart';
import { Button, Card, ChipSelect, Field, ListRow, Muted, SectionTitle } from '../../src/components/ui';
import { money, parseMoney, shortDate } from '../../src/dates';
import { buckets, jobTotals, Period, PERIOD_LABEL } from '../../src/finance';
import { useStore } from '../../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';
import { Job } from '../../src/types';

type Tab = 'jobs' | 'earnings';
const ALL = '__all';
const NONE = '__none';

const STATUS_LABEL: Record<Job['status'], string> = { open: 'Open', invoiced: 'Invoice sent', paid: 'Paid' };

export default function JobsScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { jobs, timeEntries, expenses, technicians, prefs, fleetAssets, saveJob, technicianName } = useStore();
  const [tab, setTab] = useState<Tab>('jobs');

  // New job form
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [contact, setContact] = useState('');
  const [techId, setTechId] = useState<string>(prefs.meTechnicianId ?? NONE);
  const [rate, setRate] = useState(String(technicians.find((t) => t.id === prefs.meTechnicianId)?.hourlyRate ?? ''));
  const [assetId, setAssetId] = useState<string>(NONE);

  // Earnings
  const [period, setPeriod] = useState<Period>('week');
  const [who, setWho] = useState<string>(ALL);

  const pickTech = (id: string) => {
    setTechId(id);
    const r = technicians.find((t) => t.id === id)?.hourlyRate;
    if (r !== undefined) setRate(String(r));
  };

  const create = () => {
    const r = parseMoney(rate || '0');
    const { error, id } = saveJob({
      title,
      client: client.trim() || undefined,
      clientContact: contact.trim() || undefined,
      technicianId: techId === NONE ? undefined : techId,
      assetId: assetId === NONE ? undefined : assetId,
      rate: r,
    });
    if (error || !id) {
      Alert.alert('Cannot create job', error ?? '');
      return;
    }
    setAdding(false);
    setTitle('');
    setClient('');
    setContact('');
    router.push({ pathname: '/jobs/[id]', params: { id } });
  };

  const sorted = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: { status: Job['status']; items: Job[] }[] = (['open', 'invoiced', 'paid'] as const).map((st) => ({
    status: st,
    items: sorted.filter((j) => j.status === st),
  }));

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
      <Stack.Screen options={{ title: 'Jobs & time' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: spacing.lg }}>
          <ChipSelect
            options={[
              { value: 'jobs', label: 'Jobs & invoices' },
              { value: 'earnings', label: 'Earnings & expenses' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>

        {tab === 'jobs' ? (
          <>
            {adding ? (
              <Card style={{ marginBottom: spacing.lg }}>
                <Field label="Job name" placeholder="e.g. Week of Oct 19, Smith driveway" value={title} onChangeText={setTitle} />
                <Field label="Bill to" placeholder="Customer or company" value={client} onChangeText={setClient} />
                <Field label="Customer phone / email" value={contact} onChangeText={setContact} autoCapitalize="none" />
                <Text style={s.label}>Who is working</Text>
                <ChipSelect
                  options={[...technicians.map((t) => ({ value: t.id, label: t.name })), { value: NONE, label: 'Not set' }]}
                  value={techId}
                  onChange={pickTech}
                />
                <View style={{ height: spacing.md }} />
                <Field label="Hourly rate ($)" keyboardType="decimal-pad" placeholder="e.g. 85" value={rate} onChangeText={setRate} />
                <Text style={s.label}>Machine (optional)</Text>
                <ChipSelect
                  options={[{ value: NONE, label: 'None' }, ...fleetAssets.map((a) => ({ value: a.id, label: a.name }))]}
                  value={assetId}
                  onChange={setAssetId}
                />
                <View style={[s.two, { marginTop: spacing.md }]}>
                  <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
                  <Button title="Create job" style={{ flex: 1 }} onPress={create} />
                </View>
              </Card>
            ) : (
              <Button title="+ New job or work week" onPress={() => setAdding(true)} style={{ marginBottom: spacing.lg }} />
            )}

            {jobs.length === 0 ? <Muted>No jobs yet. Create one to start tracking hours and expenses.</Muted> : null}
            {groups
              .filter((g) => g.items.length)
              .map((g) => (
                <View key={g.status} style={{ marginBottom: spacing.md }}>
                  <SectionTitle>{`${STATUS_LABEL[g.status]} (${g.items.length})`}</SectionTitle>
                  {g.items.map((j) => {
                    const t = jobTotals(j, timeEntries, expenses);
                    return (
                      <ListRow
                        key={j.id}
                        title={j.title}
                        subtitle={[
                          j.client,
                          technicianName(j.technicianId) !== 'Unassigned' ? technicianName(j.technicianId) : undefined,
                          `${t.hours} h`,
                          j.invoiceNumber ? `#${j.invoiceNumber}` : undefined,
                          j.status === 'paid' && j.checkNumber ? `check ${j.checkNumber}` : shortDate(j.createdAt),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        right={money(t.total)}
                        dot={j.status === 'paid' ? c.ok : j.status === 'invoiced' ? c.warn : c.accent}
                        onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })}
                      />
                    );
                  })}
                </View>
              ))}
          </>
        ) : (
          <>
            <Text style={s.label}>Person</Text>
            <ChipSelect
              options={[{ value: ALL, label: 'Everyone' }, ...technicians.map((t) => ({ value: t.id, label: t.name }))]}
              value={who}
              onChange={setWho}
            />
            <View style={{ height: spacing.md }} />
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
  });
