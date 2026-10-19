import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, Field, SectionTitle } from '../../src/components/ui';
import { ANDROID_BUILD } from '../../src/config';
import { useStore } from '../../src/store';
import { ACCENTS, AccentKey, Palette, spacing, ThemeMode, useStyles } from '../../src/theme';

export default function PreferencesScreen() {
  const s = useStyles(makeStyles);
  const { prefs, setPrefs, technicians, resetDemoData } = useStore();

  const reset = () =>
    Alert.alert('Load demo data?', 'This replaces ALL fleets, machines, technicians and service records on this phone with the demo set.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace everything', style: 'destructive', onPress: resetDemoData },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Preferences' }} />
      <ScrollView contentContainerStyle={s.content}>
        <SectionTitle>Theme</SectionTitle>
        <Card style={s.card}>
          <Text style={s.label}>Appearance</Text>
          <ChipSelect
            options={[
              { value: 'system', label: 'Match phone' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            value={prefs.theme}
            onChange={(v) => setPrefs({ theme: v as ThemeMode })}
          />
          <Text style={[s.label, { marginTop: spacing.md }]}>Accent color</Text>
          <ChipSelect
            options={(Object.keys(ACCENTS) as AccentKey[]).map((k) => ({ value: k, label: ACCENTS[k].label }))}
            value={prefs.accent}
            onChange={(v) => setPrefs({ accent: v as AccentKey })}
          />
        </Card>

        <SectionTitle>This phone</SectionTitle>
        <Card style={s.card}>
          <Text style={s.label}>Who uses this phone?</Text>
          <ChipSelect
            options={technicians.map((t) => ({ value: t.id, label: t.name }))}
            value={prefs.meTechnicianId}
            onChange={(v) => setPrefs({ meTechnicianId: v })}
          />
          <Text style={s.help}>Pre-fills “Service done by” and assignments.</Text>
        </Card>

        <SectionTitle>Invoice details</SectionTitle>
        <Card style={s.card}>
          <Field
            label="Business name"
            value={prefs.business.name ?? ''}
            onChangeText={(v) => setPrefs({ business: { ...prefs.business, name: v || undefined } })}
          />
          <Field
            label="Phone"
            keyboardType="phone-pad"
            value={prefs.business.phone ?? ''}
            onChangeText={(v) => setPrefs({ business: { ...prefs.business, phone: v || undefined } })}
          />
          <Field
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={prefs.business.email ?? ''}
            onChangeText={(v) => setPrefs({ business: { ...prefs.business, email: v || undefined } })}
          />
          <Field
            label="Address"
            multiline
            value={prefs.business.address ?? ''}
            onChangeText={(v) => setPrefs({ business: { ...prefs.business, address: v || undefined } })}
          />
          <Field
            label="Next invoice number"
            keyboardType="number-pad"
            value={String(prefs.business.nextInvoiceNumber)}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              if (Number.isFinite(n) && n > 0) setPrefs({ business: { ...prefs.business, nextInvoiceNumber: n } });
            }}
          />
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={s.card}>
          <Text style={s.help}>
            Data is stored on this phone. Shared fleets across phones will come with sign-in. Demo data includes factory schedules for a
            Kubota L3901, Bobcat T595 and Honda EU7000is.
          </Text>
          <Button title="Load demo data" variant="danger" onPress={reset} style={{ marginTop: spacing.sm }} />
        </Card>

        <Text style={s.version}>
          Service Ceo {Constants.expoConfig?.version ?? ''}
          {ANDROID_BUILD ? ` · Android build ${ANDROID_BUILD}` : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    card: { marginBottom: spacing.lg },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    help: { color: c.muted, fontSize: 13, marginTop: spacing.sm },
    version: { color: c.muted, fontSize: 12, textAlign: 'center' },
  });
