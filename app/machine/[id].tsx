import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignmentCard } from '../../src/components/AssignmentCard';
import { Button, Card, CheckRow, ChipSelect, Field, Input, levelColor, Muted, SectionTitle } from '../../src/components/ui';
import { LEVEL_LABEL, machineStatus } from '../../src/maintenance';
import { newId, useStore } from '../../src/store';
import { Palette, spacing, useStyles, useTheme } from '../../src/theme';
import { ChecklistItem } from '../../src/types';

const SELF = '__self';

/** One machine: what it needs, and handing work to a technician. */
export default function MachineScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { assets, tasks, thresholds, technicians, fleets, assignments, saveAssignment, prefs } = useStore();
  const asset = assets.find((a) => a.id === id);
  const fleet = fleets.find((f) => f.id === asset?.fleetId);
  const status = asset ? machineStatus(asset, tasks, new Date(), thresholds) : undefined;

  const [assigning, setAssigning] = useState(false);
  const [who, setWho] = useState<string>(prefs.meTechnicianId ?? SELF);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [notes, setNotes] = useState('');

  if (!asset || !status) {
    return (
      <View style={s.content}>
        <Muted>Machine not found.</Muted>
      </View>
    );
  }

  const members = technicians.filter((t) => fleet?.memberIds.includes(t.id));
  const work = assignments
    .filter((a) => a.assetId === asset.id)
    .sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'open' ? -1 : 1));

  const startAssign = () => {
    // Pre-tick everything that needs attention.
    setPicked(status.needs.map((d) => d.task.id));
    setCustom([]);
    setNotes('');
    setAssigning(true);
  };

  const addCustom = () => {
    if (!newItem.trim()) return;
    setCustom((x) => [...x, newItem.trim()]);
    setNewItem('');
  };

  const save = () => {
    const items: ChecklistItem[] = [
      ...status.all.filter((d) => picked.includes(d.task.id)).map((d) => ({ id: newId(), text: d.task.name, done: false })),
      ...custom.map((text) => ({ id: newId(), text, done: false })),
    ];
    const error = saveAssignment({
      assetId: asset.id,
      technicianId: who === SELF ? undefined : who,
      createdAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      items,
      status: 'open',
    });
    if (error) {
      Alert.alert('Cannot assign', error);
      return;
    }
    setAssigning(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: asset.name }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={[s.banner, { borderColor: levelColor(c, status.level) }]}>
          <View style={[s.bannerDot, { backgroundColor: levelColor(c, status.level) }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerText, { color: levelColor(c, status.level) }]}>{LEVEL_LABEL[status.level]}</Text>
            <Text style={s.bannerSub}>
              {asset.currentHours} h · Serial {asset.serial || '—'}
            </Text>
          </View>
        </View>

        <View style={s.actions}>
          <Button
            title="Record service"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/service', params: { assetId: asset.id } })}
          />
          {!assigning && <Button title="Assign work" variant="secondary" style={{ flex: 1 }} onPress={startAssign} />}
        </View>

        {assigning && (
          <View style={s.section}>
            <SectionTitle>Assign work</SectionTitle>
            <Card>
              <Text style={s.label}>Assign to</Text>
              <ChipSelect
                options={[...members.map((t) => ({ value: t.id, label: t.name })), { value: SELF, label: 'Note to self' }]}
                value={who}
                onChange={setWho}
              />
              <Text style={[s.label, { marginTop: spacing.md }]}>Checklist</Text>
              {status.all.map((d) => (
                <CheckRow
                  key={d.task.id}
                  checked={picked.includes(d.task.id)}
                  onToggle={() =>
                    setPicked((p) => (p.includes(d.task.id) ? p.filter((x) => x !== d.task.id) : [...p, d.task.id]))
                  }
                  title={d.task.name}
                  detail={d.detail}
                  detailColor={d.level === 'green' ? undefined : levelColor(c, d.level)}
                />
              ))}
              {custom.map((t, i) => (
                <CheckRow key={`c${i}`} checked onToggle={() => setCustom((x) => x.filter((_, j) => j !== i))} title={t} detail="Tap to remove" />
              ))}
              <View style={s.addRow}>
                <Input
                  style={{ flex: 1 }}
                  placeholder="Add a task (e.g. Wash machine)"
                  value={newItem}
                  onChangeText={setNewItem}
                  onSubmitEditing={addCustom}
                  returnKeyType="done"
                />
                <Button title="Add" variant="secondary" onPress={addCustom} />
              </View>
              <Field label="Notes for the technician" placeholder="What you want done, when, anything to watch for" value={notes} onChangeText={setNotes} multiline />
              <View style={s.actions}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAssigning(false)} />
                <Button title="Save assignment" style={{ flex: 1 }} onPress={save} />
              </View>
            </Card>
          </View>
        )}

        <View style={s.section}>
          <SectionTitle>Assigned work</SectionTitle>
          {work.length === 0 ? <Muted>Nothing assigned.</Muted> : work.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
        </View>

        <View style={s.section}>
          <SectionTitle>Service items</SectionTitle>
          <Card>
            {status.all.map((d) => (
              <View key={d.task.id} style={s.itemRow}>
                <View style={[s.itemDot, { backgroundColor: levelColor(c, d.level) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{d.task.name}</Text>
                  <Text style={[s.itemDetail, d.level !== 'green' && { color: levelColor(c, d.level) }]}>{d.detail}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 2,
      borderRadius: 12,
      padding: spacing.md,
      backgroundColor: c.card,
      marginBottom: spacing.md,
    },
    bannerDot: { width: 20, height: 20, borderRadius: 10 },
    bannerText: { fontSize: 18, fontWeight: '800' },
    bannerSub: { color: c.muted, fontSize: 14, marginTop: 2 },
    actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    section: { marginBottom: spacing.lg },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    addRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    itemDot: { width: 12, height: 12, borderRadius: 6 },
    itemName: { color: c.text, fontSize: 16, fontWeight: '700' },
    itemDetail: { color: c.muted, fontSize: 14, marginTop: 2 },
  });
