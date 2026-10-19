import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, Field, SectionTitle } from '../../src/components/ui';
import { useAuth } from '../../src/auth';
import { ROLE_LABEL, useCloud } from '../../src/cloud';
import { ANDROID_BUILD } from '../../src/config';
import { useStore } from '../../src/store';
import { ACCENTS, AccentKey, Palette, spacing, ThemeMode, useStyles } from '../../src/theme';

export default function PreferencesScreen() {
  const s = useStyles(makeStyles);
  const { prefs, setPrefs, activeFleet } = useStore();
  const { email, signOut } = useAuth();
  const { myRole, lastSync, syncError } = useCloud();



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

        <SectionTitle>Account</SectionTitle>
        <Card style={s.card}>
          <Text style={s.value}>{email}</Text>
          <Text style={s.help}>
            {activeFleet.name}: {myRole ? ROLE_LABEL[myRole] : 'not connected yet'}
            {'\n'}
            {syncError ? `Sync problem: ${syncError}` : lastSync ? `Last synced ${lastSync.toLocaleTimeString()}` : 'Syncing…'}
          </Text>
          <Button
            title="Sign out"
            variant="danger"
            onPress={() =>
              Alert.alert('Sign out?', 'Your data stays online. Sign in again any time.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: signOut },
              ])
            }
            style={{ marginTop: spacing.sm }}
          />
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
    value: { color: c.text, fontSize: 17, fontWeight: '700' },
    help: { color: c.muted, fontSize: 13, marginTop: spacing.sm },
    version: { color: c.muted, fontSize: 12, textAlign: 'center' },
  });
