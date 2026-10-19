import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { useCloud } from '../cloud';
import { Button, Card, ChipSelect, Field, SectionTitle } from '../components/ui';
import { loadLegacyData } from '../store';
import { Palette, spacing, useStyles } from '../theme';
import { AppData, Fleet } from '../types';

/** First time on an account: put this phone's fleets online, join a crew, or start a new fleet. */
export function Onboarding() {
  const s = useStyles(makeStyles);
  const { email, signOut, session } = useAuth();
  const cloud = useCloud();
  const metaName = (session?.user.user_metadata?.name as string | undefined) ?? '';
  const [name, setName] = useState(metaName || (email ? email.split('@')[0] : ''));
  const [legacy, setLegacy] = useState<AppData | null>(null);
  const [code, setCode] = useState('');
  const [fleetName, setFleetName] = useState('');
  const [kind, setKind] = useState<Fleet['kind']>('work');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLegacyData().then(setLegacy);
  }, []);

  const run = async (what: string, fn: () => Promise<string | null>) => {
    setError(null);
    setBusy(what);
    const e = await fn();
    setBusy(null);
    if (e) setError(e);
  };

  const legacySummary = legacy
    ? `${legacy.fleets.length} fleet${legacy.fleets.length === 1 ? '' : 's'}, ${legacy.assets.length} machines, ${legacy.logs.length} service records, ${legacy.jobs.length} jobs`
    : '';

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Welcome{name ? `, ${name.split(' ')[0]}` : ''}</Text>
        <Text style={s.sub}>Signed in as {email}. How do you want to start?</Text>

        <Field label="Your name (shown to your crew)" autoCapitalize="words" value={name} onChangeText={setName} />
        {error ? <Text style={s.error}>{error}</Text> : null}

        <SectionTitle>Join a crew</SectionTitle>
        <Card style={s.card}>
          <Text style={s.body}>Your fleet owner gives you a 6-letter invite code (Settings › Crew & sharing on their phone).</Text>
          <Field label="Invite code" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
          <Button title={busy === 'join' ? 'Joining…' : 'Join crew'} disabled={!!busy} onPress={() => run('join', () => cloud.joinCrew(code, name))} />
        </Card>

        {legacy && legacy.fleets.length > 0 && (
          <>
            <SectionTitle>I'm the owner: put this phone's data online</SectionTitle>
            <Card style={s.card}>
              <Text style={s.body}>
                This phone has {legacySummary}. Upload it to your account and you become the owner of those fleets. Then invite your crew.
              </Text>
              <Button
                title={busy === 'upload' ? 'Uploading…' : 'Upload and become owner'}
                disabled={!!busy}
                onPress={() => run('upload', () => cloud.uploadPhoneData(legacy, name))}
              />
            </Card>
          </>
        )}

        <SectionTitle>Start a new fleet</SectionTitle>
        <Card style={s.card}>
          <Field label="Fleet name" placeholder="e.g. Rental Fleet, Home" value={fleetName} onChangeText={setFleetName} />
          <View style={{ marginBottom: spacing.md }}>
            <ChipSelect
              options={[
                { value: 'work', label: 'Work' },
                { value: 'home', label: 'Home / family' },
              ]}
              value={kind}
              onChange={(v) => setKind(v as Fleet['kind'])}
            />
          </View>
          <Button
            title={busy === 'new' ? 'Creating…' : 'Create fleet'}
            variant="secondary"
            disabled={!!busy}
            onPress={() => run('new', () => cloud.startNewFleet(fleetName, kind, name))}
          />
        </Card>

        <Button title="Sign out" variant="secondary" onPress={signOut} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { padding: spacing.md, paddingTop: 70, paddingBottom: spacing.lg * 3 },
    title: { color: c.text, fontSize: 28, fontWeight: '900' },
    sub: { color: c.muted, fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.lg },
    card: { marginBottom: spacing.lg },
    body: { color: c.text, fontSize: 15, lineHeight: 21, marginBottom: spacing.md },
    error: { color: c.danger, fontSize: 15, marginBottom: spacing.md },
  });
