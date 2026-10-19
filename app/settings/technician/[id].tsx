import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, CheckRow, ChipSelect, Field, SectionTitle } from '../../../src/components/ui';
import { useCloud } from '../../../src/cloud';
import { useStore } from '../../../src/store';
import { Palette, spacing, useStyles } from '../../../src/theme';

export default function TechnicianEditScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { technicians, fleets, prefs, saveTechnician, deleteTechnician, saveFleet, setPrefs } = useStore();
  const { isOwner } = useCloud();
  const existing = technicians.find((t) => t.id === id);
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [rate, setRate] = useState(existing?.hourlyRate !== undefined ? String(existing.hourlyRate) : '');
  const [fleetIds, setFleetIds] = useState<string[]>(
    existing ? fleets.filter((f) => f.memberIds.includes(existing.id)).map((f) => f.id) : [],
  );
  const [isMe, setIsMe] = useState(!!existing && prefs.meTechnicianId === existing.id);

  const save = () => {
    const { error, id: techId } = saveTechnician({
      id: existing?.id,
      name,
      role: role.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      hourlyRate: rate.trim() && Number.isFinite(Number(rate.replace(/[$,]/g, ''))) ? Number(rate.replace(/[$,]/g, '')) : undefined,
    });
    if (error || !techId) {
      Alert.alert('Cannot save', error ?? 'Unknown error');
      return;
    }
    // Update fleet memberships.
    fleets.forEach((f) => {
      const member = f.memberIds.includes(techId);
      const want = fleetIds.includes(f.id);
      if (member !== want) {
        saveFleet({ ...f, memberIds: want ? [...f.memberIds, techId] : f.memberIds.filter((m) => m !== techId) });
      }
    });
    if (isMe) setPrefs({ meTechnicianId: techId });
    else if (prefs.meTechnicianId === techId) setPrefs({ meTechnicianId: undefined });
    router.back();
  };

  const remove = () =>
    Alert.alert(`Remove ${existing?.name}?`, 'Their past service records keep their name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteTechnician(existing!.id);
          router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: isNew ? 'New technician' : 'Edit technician' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Name" autoCapitalize="words" value={name} onChangeText={setName} />
          <Field label="Role" placeholder="e.g. Technician, Shop lead, Family" value={role} onChangeText={setRole} />
          <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          {isOwner ? (
            <Field
              label="Hourly rate ($)"
              keyboardType="decimal-pad"
              placeholder="Used for new jobs"
              value={rate}
              onChangeText={setRate}
              hint="Private: only you (the owner) and this person can see it."
            />
          ) : null}
          <CheckRow checked={isMe} onToggle={() => setIsMe((v) => !v)} title="This is me" detail="Pre-fills “Service done by” on this phone" />
        </Card>

        <View style={s.section}>
          <SectionTitle>Fleets</SectionTitle>
          <Card>
            <Text style={s.help}>Which fleets this person works on.</Text>
            <ChipSelect
              multi
              options={fleets.map((f) => ({ value: f.id, label: f.name }))}
              value={fleetIds}
              onChange={(v) => setFleetIds((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]))}
            />
          </Card>
        </View>

        <Button title="Save" onPress={save} />
        {!isNew && <Button title="Remove technician" variant="danger" onPress={remove} style={{ marginTop: spacing.sm }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    section: { marginTop: spacing.lg, marginBottom: spacing.md },
    help: { color: c.muted, fontSize: 14, marginBottom: spacing.sm },
  });
