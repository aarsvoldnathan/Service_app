import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { computeDue, Thresholds } from '../maintenance';
import { useStore } from '../store';
import { Palette, radius, spacing, useStyles, useTheme } from '../theme';
import { Asset, ServiceTask, TaskKind } from '../types';
import { Button, ChipSelect, Field, levelColor } from './ui';

const KIND_OPTIONS: { value: TaskKind; label: string }[] = [
  { value: 'routine', label: 'Routine (filters, fluids, grease)' },
  { value: 'major', label: 'Scheduled service (oil, filters)' },
];

function intervalText(t: ServiceTask) {
  const parts: string[] = [];
  if (t.intervalHours) parts.push(`every ${t.intervalHours} h`);
  if (t.intervalDays) parts.push(`every ${t.intervalDays} days`);
  return parts.join(' or ') || 'No interval';
}

type Draft = {
  name: string;
  kind: TaskKind;
  hours: string;
  days: string;
  lastHours: string;
  notes: string;
};

const toDraft = (t?: ServiceTask, asset?: Asset): Draft => ({
  name: t?.name ?? '',
  kind: t?.kind ?? 'major',
  hours: t?.intervalHours ? String(t.intervalHours) : '',
  days: t?.intervalDays ? String(t.intervalDays) : '',
  lastHours: String(t?.lastDoneHours ?? asset?.currentHours ?? 0),
  notes: t?.notes ?? '',
});

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

function TaskEditor({
  asset,
  task,
  onDone,
}: {
  asset: Asset;
  task?: ServiceTask;
  onDone: () => void;
}) {
  const s = useStyles(makeStyles);
  const { saveTask, deleteTask } = useStore();
  const [d, setD] = useState<Draft>(() => toDraft(task, asset));
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const save = () => {
    const lastHours = Number(d.lastHours.replace(',', '.'));
    if (!Number.isFinite(lastHours) || lastHours < 0) {
      Alert.alert('Check the hours', 'Enter the hours when this was last done.');
      return;
    }
    const error = saveTask({
      id: task?.id,
      assetId: asset.id,
      name: d.name,
      kind: d.kind,
      intervalHours: num(d.hours),
      intervalDays: num(d.days),
      lastDoneHours: lastHours,
      lastDoneDate: task?.lastDoneDate ?? new Date().toISOString(),
      notes: d.notes.trim() || undefined,
    });
    if (error) Alert.alert('Cannot save', error);
    else onDone();
  };

  const remove = () =>
    Alert.alert('Delete service item?', `"${task?.name}" will be removed from this machine's schedule.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (task) deleteTask(task.id);
          onDone();
        },
      },
    ]);

  return (
    <View style={s.editor}>
      <Field label="Service item" placeholder="e.g. Engine oil and filter" value={d.name} onChangeText={(v) => set({ name: v })} />
      <Text style={s.label}>Type</Text>
      <ChipSelect options={KIND_OPTIONS} value={d.kind} onChange={(v) => set({ kind: v })} />
      <View style={[s.two, { marginTop: spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Field label="Every (hours)" placeholder="e.g. 250" keyboardType="decimal-pad" value={d.hours} onChangeText={(v) => set({ hours: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Every (days)" placeholder="optional" keyboardType="number-pad" value={d.days} onChangeText={(v) => set({ days: v })} />
        </View>
      </View>
      <Field
        label="Last done at (hours)"
        keyboardType="decimal-pad"
        value={d.lastHours}
        onChangeText={(v) => set({ lastHours: v })}
        hint="Logging this service later resets it automatically."
      />
      <Field label="Notes" placeholder="Part numbers, fluid type, first-service notes" value={d.notes} onChangeText={(v) => set({ notes: v })} />
      <View style={s.two}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onDone} />
        <Button title="Save" style={{ flex: 1 }} onPress={save} />
      </View>
      {task ? <Button title="Delete item" variant="danger" onPress={remove} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

/** Lists a machine's service items and lets the user change intervals, add or remove items. */
export function ScheduleEditor({ asset, thresholds }: { asset: Asset; thresholds: Thresholds }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const { tasks } = useStore();
  const [editing, setEditing] = useState<string | null>(null); // task id, 'new', or null
  const now = new Date();
  const items = tasks
    .filter((t) => t.assetId === asset.id)
    .sort((a, b) => (a.kind === b.kind ? (a.intervalHours ?? 1e9) - (b.intervalHours ?? 1e9) : a.kind === 'routine' ? -1 : 1));

  return (
    <View>
      {items.length === 0 && <Text style={s.empty}>No service items yet.</Text>}
      {items.map((t) =>
        editing === t.id ? (
          <TaskEditor key={t.id} asset={asset} task={t} onDone={() => setEditing(null)} />
        ) : (
          <Pressable
            key={t.id}
            onPress={() => setEditing(t.id)}
            accessibilityRole="button"
            accessibilityHint="Edit interval"
            style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
          >
            <View style={[s.dot, { backgroundColor: levelColor(c, computeDue(t, asset, now, thresholds).level) }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{t.name}</Text>
              <Text style={s.meta}>
                {t.kind === 'routine' ? 'Routine' : 'Scheduled'} · {intervalText(t)} · last at {t.lastDoneHours} h
              </Text>
              {t.notes ? <Text style={s.notes}>{t.notes}</Text> : null}
            </View>
            <Text style={s.edit}>Edit</Text>
          </Pressable>
        ),
      )}
      {editing === 'new' ? (
        <TaskEditor asset={asset} onDone={() => setEditing(null)} />
      ) : (
        <Button title="+ Add service item" variant="secondary" onPress={() => setEditing('new')} style={{ marginTop: spacing.sm }} />
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      minHeight: 56,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    name: { color: c.text, fontSize: 16, fontWeight: '700' },
    meta: { color: c.muted, fontSize: 13, marginTop: 2 },
    notes: { color: c.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
    edit: { color: c.accent, fontSize: 15, fontWeight: '700' },
    empty: { color: c.muted, fontSize: 15, paddingVertical: spacing.sm },
    editor: {
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: radius,
      padding: spacing.md,
      marginVertical: spacing.sm,
      backgroundColor: c.bg,
    },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    two: { flexDirection: 'row', gap: spacing.sm },
  });
