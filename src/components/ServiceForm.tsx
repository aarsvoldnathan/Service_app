import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { computeDue, Thresholds } from '../maintenance';
import { Palette, spacing, touch, useStyles, useTheme } from '../theme';
import { Asset, NewServiceLog, PartUsed, ServiceTask, Technician } from '../types';
import { Button, Card, CheckRow, ChipSelect, Field, Input, levelColor } from './ui';

type Props = {
  asset: Asset;
  tasks: ServiceTask[];
  thresholds: Thresholds;
  technicians: Technician[];
  defaultTechnicianId?: string;
  onSubmit: (entry: NewServiceLog) => string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const todayText = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "2026-10-18" -> ISO timestamp at local noon, or null if invalid. */
function parseDate(text: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now() + 86_400_000) return null;
  return date.toISOString();
}

const emptyPart = (): PartUsed => ({ name: '', partNumber: '', quantity: '1' });

export function ServiceForm({ asset, tasks, thresholds, technicians, defaultTechnicianId, onSubmit }: Props) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const defaultName = technicians.find((t) => t.id === defaultTechnicianId)?.name ?? '';
  const [performedBy, setPerformedBy] = useState(defaultName);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [parts, setParts] = useState<PartUsed[]>([]);
  const [dateText, setDateText] = useState(todayText());
  const [hoursText, setHoursText] = useState(String(asset.currentHours));
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);

  // Follow hour updates made at the top of the screen.
  useEffect(() => setHoursText(String(asset.currentHours)), [asset.currentHours]);

  const scheduled = useMemo(() => {
    const now = new Date();
    return tasks.map((t) => computeDue(t, asset, now, thresholds)).sort((a, b) => a.urgency - b.urgency);
  }, [tasks, asset, thresholds]);

  const toggleTask = (task: ServiceTask) => {
    const next = completed.includes(task.id) ? completed.filter((id) => id !== task.id) : [...completed, task.id];
    setCompleted(next);
    // Build the title from the ticked items until the user types their own.
    if (!titleTouched) {
      setTitle(tasks.filter((t) => next.includes(t.id)).map((t) => t.name).join(', '));
    }
  };

  const setPart = (i: number, patch: Partial<PartUsed>) =>
    setParts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    const date = parseDate(dateText);
    if (!date) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD, for example 2026-10-18.');
      return;
    }
    const cleanParts = parts
      .map((p) => ({
        name: p.name.trim(),
        partNumber: p.partNumber?.trim() || undefined,
        quantity: p.quantity?.trim() || undefined,
      }))
      .filter((p) => p.name || p.partNumber);

    const error = onSubmit({
      assetId: asset.id,
      performedBy: performedBy.trim(),
      taskName: title.trim(),
      description: description.trim() || undefined,
      parts: cleanParts,
      date,
      hoursAtService: Number(hoursText.replace(',', '.')),
      completedTaskIds: completed,
      notes: notes.trim() || undefined,
    });
    if (error) {
      Alert.alert('Cannot save service', error);
      return;
    }
    Keyboard.dismiss();
    Alert.alert('Service saved', `${title.trim()} logged for ${asset.name}.`);
    setTitle('');
    setTitleTouched(false);
    setDescription('');
    setParts([]);
    setNotes('');
    setCompleted([]);
  };

  return (
    <Card>
      <Text style={s.label}>Service done by</Text>
      {technicians.length > 0 && (
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelect
            options={technicians.map((t) => ({ value: t.name, label: t.name }))}
            value={performedBy}
            onChange={setPerformedBy}
          />
        </View>
      )}
      <Field label="Or type a name" placeholder="Name" value={performedBy} onChangeText={setPerformedBy} autoCapitalize="words" />

      {scheduled.length > 0 && (
        <View style={s.block}>
          <Text style={s.label}>Scheduled services completed</Text>
          {scheduled.map((d) => (
            <CheckRow
              key={d.task.id}
              checked={completed.includes(d.task.id)}
              onToggle={() => toggleTask(d.task)}
              title={d.task.name}
              detail={d.detail}
              detailColor={d.level === 'green' ? undefined : levelColor(c, d.level)}
            />
          ))}
        </View>
      )}

      <Field
        label="Service"
        placeholder="e.g. Engine oil and filter"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTitleTouched(true);
        }}
      />
      <Field label="Description" placeholder="What was done, what was found" value={description} onChangeText={setDescription} multiline />

      <View style={s.block}>
        <Text style={s.label}>Parts used</Text>
        {asset.specs.filters.length > 0 && (
          <View style={s.quickRow}>
            {asset.specs.filters.map((f, i) => (
              <Pressable
                key={i}
                onPress={() => setParts((p) => [...p, { name: f.label, partNumber: f.partNumber, quantity: '1' }])}
                style={({ pressed }) => [s.quick, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${f.label} ${f.partNumber}`}
              >
                <Text style={s.quickText}>+ {f.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {parts.map((p, i) => (
          <View key={i} style={s.partRow}>
            <Input style={{ flex: 2 }} placeholder="Part" value={p.name} onChangeText={(v) => setPart(i, { name: v })} />
            <Input
              style={{ flex: 2 }}
              placeholder="Part #"
              autoCapitalize="characters"
              value={p.partNumber}
              onChangeText={(v) => setPart(i, { partNumber: v })}
            />
            <Input
              style={{ width: 56, textAlign: 'center' }}
              placeholder="Qty"
              keyboardType="decimal-pad"
              value={p.quantity}
              onChangeText={(v) => setPart(i, { quantity: v })}
            />
            <Button
              title="✕"
              variant="danger"
              accessibilityLabel="Remove part"
              style={{ width: touch, paddingHorizontal: 0 }}
              onPress={() => setParts((x) => x.filter((_, j) => j !== i))}
            />
          </View>
        ))}
        <Button title="+ Add part" variant="secondary" onPress={() => setParts((p) => [...p, emptyPart()])} />
      </View>

      <View style={s.twoCol}>
        <View style={{ flex: 1 }}>
          <Field label="Date (YYYY-MM-DD)" value={dateText} onChangeText={setDateText} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Hours at service" value={hoursText} onChangeText={setHoursText} keyboardType="decimal-pad" />
        </View>
      </View>

      <Field label="Notes" placeholder="Anything else (next service, issues found)" value={notes} onChangeText={setNotes} multiline />

      <Button title="Save service" onPress={submit} />
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    block: { marginBottom: spacing.md },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    quick: {
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      minHeight: 40,
      justifyContent: 'center',
    },
    quickText: { color: c.accent, fontSize: 15, fontWeight: '700' },
    partRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
    twoCol: { flexDirection: 'row', gap: spacing.sm },
  });
