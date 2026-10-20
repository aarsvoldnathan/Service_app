import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Field, SectionTitle } from '../../src/components/ui';
import { money, parseMoney } from '../../src/dates';
import { taxPercent } from '../../src/finance';
import { useStore } from '../../src/store';
import { font, Palette, spacing, useStyles } from '../../src/theme';

/** Presets used by invoices and the Hours page: tax set-aside, business details, rate, who gets the hours. */
export default function InvoiceSettings() {
  const s = useStyles(makeStyles);
  const { prefs, setPrefs, jobs, saveJob } = useStore();
  const biz = prefs.business;
  const hours = prefs.hours ?? {};
  const [tax, setTax] = useState(String(taxPercent(prefs)));
  const [rate, setRate] = useState(hours.rate !== undefined ? String(hours.rate) : '');
  const [nextNo, setNextNo] = useState(String(biz.nextInvoiceNumber));

  const setBiz = (patch: Partial<typeof biz>) => setPrefs({ business: { ...biz, ...patch } });
  const setHours = (patch: Partial<typeof hours>) => setPrefs({ hours: { ...hours, ...patch } });

  const saveTax = () => {
    const n = Number(tax.replace('%', '').trim());
    if (Number.isFinite(n) && n >= 0 && n <= 90) setPrefs({ taxRate: n });
    else setTax(String(taxPercent(prefs)));
  };
  const saveRate = () => {
    const r = rate.trim() ? parseMoney(rate) : undefined;
    if (r !== undefined && (!Number.isFinite(r) || r < 0)) return setRate(hours.rate !== undefined ? String(hours.rate) : '');
    setHours({ rate: r });
    // The running hours invoice uses the new rate too.
    const running = jobs.find((j) => j.weekly && j.status === 'open' && j.technicianId === prefs.meTechnicianId);
    if (running && r !== undefined) saveJob({ ...running, rate: r });
  };
  const saveNextNo = () => {
    const n = Math.floor(Number(nextNo));
    if (Number.isFinite(n) && n > 0) setBiz({ nextInvoiceNumber: n });
    else setNextNo(String(biz.nextInvoiceNumber));
  };

  const pct = taxPercent(prefs);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: 'Invoice & tax settings' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Taxes</SectionTitle>
        <Card style={s.card}>
          <Field label="Set aside for taxes (%)" keyboardType="decimal-pad" value={tax} onChangeText={setTax} onEndEditing={saveTax} onSubmitEditing={saveTax} />
          <Text style={s.help}>
            Shown on every invoice and in earnings. Example: on a {money(2000)} invoice, set aside {money((2000 * pct) / 100)} and keep {money(2000 - (2000 * pct) / 100)}.
          </Text>
        </Card>

        <SectionTitle>On your invoices</SectionTitle>
        <Card style={s.card}>
          <Field label="Business or your name" value={biz.name ?? ''} onChangeText={(v) => setBiz({ name: v || undefined })} />
          <Field label="Phone" keyboardType="phone-pad" value={biz.phone ?? ''} onChangeText={(v) => setBiz({ phone: v || undefined })} />
          <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={biz.email ?? ''} onChangeText={(v) => setBiz({ email: v || undefined })} />
          <Field label="Address" multiline value={biz.address ?? ''} onChangeText={(v) => setBiz({ address: v || undefined })} />
          <Field
            label="Payment terms / note"
            placeholder="e.g. Payment due on receipt. Thank you!"
            multiline
            value={biz.terms ?? ''}
            onChangeText={(v) => setBiz({ terms: v || undefined })}
          />
          <Field label="Next invoice number" keyboardType="number-pad" value={nextNo} onChangeText={setNextNo} onEndEditing={saveNextNo} onSubmitEditing={saveNextNo} />
        </Card>

        <SectionTitle>Rate</SectionTitle>
        <Card style={s.card}>
          <Field label="My hourly rate ($)" placeholder="e.g. 35" keyboardType="decimal-pad" value={rate} onChangeText={setRate} onEndEditing={saveRate} onSubmitEditing={saveRate} />
        </Card>

        <SectionTitle>Send to</SectionTitle>
        <Card style={s.card}>
          <Field
            label="Invoice to:"
            placeholder="Company or person"
            value={hours.billTo ?? hours.bossName ?? ''}
            onChangeText={(v) => setHours({ billTo: v || undefined, bossName: undefined })}
          />
          <Field label="Phone:" placeholder="e.g. 612 555 0134" keyboardType="phone-pad" value={hours.bossPhone ?? ''} onChangeText={(v) => setHours({ bossPhone: v || undefined })} />
          <Text style={s.help}>Send invoice on the Hours page can text the invoice to this number.</Text>
        </Card>
        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    card: { marginBottom: spacing.lg },
    label: { color: c.muted, fontSize: 14, fontFamily: font.regular, marginBottom: spacing.xs },
    help: { color: c.muted, fontSize: 13, fontFamily: font.light },
  });
