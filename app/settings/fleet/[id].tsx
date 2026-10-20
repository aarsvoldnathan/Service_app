import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, Field, Muted, SectionTitle } from '../../../src/components/ui';
import { DEFAULT_THRESHOLDS } from '../../../src/maintenance';
import { useCloud } from '../../../src/cloud';
import { useStore } from '../../../src/store';
import { Palette, spacing, useStyles } from '../../../src/theme';
import { Fleet } from '../../../src/types';

const posInt = (s: string, fallback: number) => {
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function FleetEditScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fleets, technicians, assets, saveFleet, deleteFleet, setPrefs, activeFleet } = useStore();
  const { memberships, deleteFleetOnline } = useCloud();
  const existing = fleets.find((f) => f.id === id);
  const isNew = !existing;
  // New fleets belong to whoever creates them; existing fleets can only be changed by their owner.
  const canEdit = isNew || memberships.get(existing!.id)?.role === 'owner';

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<Fleet['kind']>(existing?.kind ?? 'work');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [members, setMembers] = useState<string[]>(existing?.memberIds ?? []);
  const [stale, setStale] = useState(String(existing?.staleHoursDays ?? 7));
  const [orange, setOrange] = useState(String(existing?.orangeOverdueHours ?? DEFAULT_THRESHOLDS.orangeOverdueHours));
  const [warn, setWarn] = useState(String(existing?.majorWarnHours ?? DEFAULT_THRESHOLDS.majorWarnHours));

  const save = () => {
    const { error, id: savedId } = saveFleet({
      id: existing?.id,
      name,
      kind,
      description: description.trim() || undefined,
      memberIds: members,
      staleHoursDays: posInt(stale, 7),
      orangeOverdueHours: posInt(orange, DEFAULT_THRESHOLDS.orangeOverdueHours),
      majorWarnHours: posInt(warn, DEFAULT_THRESHOLDS.majorWarnHours),
    });
    if (error) {
      Alert.alert('Cannot save fleet', error);
      return;
    }
    if (isNew && savedId) setPrefs({ activeFleetId: savedId });
    router.back();
  };

  const remove = () =>
    Alert.alert(`Delete ${existing?.name}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const error = deleteFleet(existing!.id);
          if (error) Alert.alert('Cannot delete', error);
          else {
            deleteFleetOnline(existing!.id);
            router.back();
          }
        },
      },
    ]);

  const machineCount = existing ? assets.filter((a) => a.fleetId === existing.id).length : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: isNew ? 'New fleet' : 'Edit fleet' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Fleet name" placeholder="e.g. Rental Fleet, Home" value={name} onChangeText={setName} />
          <Text style={s.label}>Type</Text>
          <ChipSelect
            options={[
              { value: 'work', label: 'Work' },
              { value: 'home', label: 'Home / family' },
            ]}
            value={kind}
            onChange={(v) => setKind(v as Fleet['kind'])}
          />
          <View style={{ height: spacing.md }} />
          <Field label="Description" placeholder="Optional" value={description} onChangeText={setDescription} multiline />
        </Card>

        <View style={s.section}>
          <SectionTitle>Members</SectionTitle>
          <Card>
            <Text style={s.help}>People who work on this fleet. They show up when logging service and assigning work.</Text>
            {technicians.length === 0 ? (
              <Muted>Add technicians in Settings › Technicians first.</Muted>
            ) : (
              <ChipSelect
                multi
                options={technicians.map((t) => ({ value: t.id, label: t.name }))}
                value={members}
                onChange={(v) => setMembers((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]))}
              />
            )}
          </Card>
        </View>

        <View style={s.section}>
          <SectionTitle>Status rules</SectionTitle>
          <Card>
            <Field
              label="Routine care turns orange when overdue by (hours)"
              keyboardType="number-pad"
              value={orange}
              onChangeText={setOrange}
              hint="Example: a 10-hour grease item turns yellow at 10 h and orange at 20 h when this is 10."
            />
            <Field
              label="Warn before scheduled service (hours)"
              keyboardType="number-pad"
              value={warn}
              onChangeText={setWarn}
              hint="Oil changes and filter changes turn yellow this many hours before they are due, red once overdue."
            />
            <Field
              label="Remind to update hours after (days)"
              keyboardType="number-pad"
              value={stale}
              onChangeText={setStale}
            />
          </Card>
        </View>

        {canEdit ? (
          <Button title="Save fleet" onPress={save} />
        ) : (
          <Text style={s.help}>Only the fleet owner can change these settings.</Text>
        )}
        {!isNew && existing!.id !== activeFleet.id && (
          <Button
            title="View this fleet"
            variant="secondary"
            onPress={() => {
              setPrefs({ activeFleetId: existing!.id });
              router.back();
            }}
            style={{ marginTop: spacing.sm }}
          />
        )}
        {!isNew && canEdit && (
          <Button
            title={machineCount ? `Delete fleet (move its ${machineCount} machines first)` : 'Delete fleet'}
            variant="danger"
            onPress={remove}
            style={{ marginTop: spacing.sm }}
          />
        )}
        <Text style={s.note}>Everyone in this fleet sees its machines, service and shopping list. Hours, rates and invoices are private to each person and the owner.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    section: { marginTop: spacing.lg, marginBottom: spacing.md },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    help: { color: c.muted, fontSize: 14, marginBottom: spacing.sm },
    note: { color: c.muted, fontSize: 12, marginTop: spacing.lg },
  });
