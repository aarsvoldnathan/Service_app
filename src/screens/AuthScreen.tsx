import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { Button, Card, ChipSelect, Field } from '../components/ui';
import { Palette, spacing, useStyles } from '../theme';

type Mode = 'signin' | 'signup';

/** Sign in or create an account. */
export function AuthScreen() {
  const s = useStyles(makeStyles);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good?: boolean } | null>(null);

  const submit = async () => {
    setMessage(null);
    if (!email.includes('@')) return setMessage({ text: 'Enter your email address.' });
    if (password.length < 6) return setMessage({ text: 'Use a password of at least 6 characters.' });
    if (mode === 'signup' && !name.trim()) return setMessage({ text: 'Enter your name so your crew knows who you are.' });
    setBusy(true);
    if (mode === 'signin') {
      const error = await signIn(email, password);
      if (error) setMessage({ text: error });
    } else {
      const { error, needsConfirm } = await signUp(email, password, name);
      if (error) setMessage({ text: error });
      else if (needsConfirm) {
        setMessage({
          text: `Almost done. We emailed a confirmation link to ${email.trim()}. Open it, then come back here and sign in.`,
          good: true,
        });
        setMode('signin');
      }
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.brand}>Service Ceo</Text>
        <Text style={s.tag}>Equipment service for your crew</Text>

        <View style={{ marginBottom: spacing.lg }}>
          <ChipSelect
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v as Mode);
              setMessage(null);
            }}
          />
        </View>

        <Card>
          {mode === 'signup' && <Field label="Your name" autoCapitalize="words" value={name} onChangeText={setName} textContentType="name" />}
          <Field
            label="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            secureTextEntry
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
          />
          {message ? <Text style={[s.message, message.good && s.good]}>{message.text}</Text> : null}
          <Button title={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} disabled={busy} onPress={submit} />
        </Card>

        <Text style={s.note}>
          Everyone on your crew signs in with their own account. Wages, hours and invoices are only visible to the person they belong to and
          the fleet owner.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { padding: spacing.md, paddingTop: 80, paddingBottom: spacing.lg * 3 },
    brand: { color: c.accent, fontSize: 34, fontWeight: '900', textAlign: 'center' },
    tag: { color: c.muted, fontSize: 16, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
    message: { color: c.danger, fontSize: 15, marginBottom: spacing.md },
    good: { color: c.ok },
    note: { color: c.muted, fontSize: 13, marginTop: spacing.lg, textAlign: 'center', lineHeight: 19 },
  });
