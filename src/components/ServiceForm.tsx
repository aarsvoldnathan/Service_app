import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeDue } from '../maintenance';
import { colors, radius, spacing, touch } from '../theme';
import { Asset, NewServiceLog, PartUsed, ServiceTask } from '../types';
import { Button, Card, CheckRow, Field } from './ui';

type Props = {
  asset: Asset;
  tasks: ServiceTask[];
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

export function ServiceForm({ asset, tasks, onSubmit }: Props) {
  const [performedBy, setPerformedBy] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parts, setParts] = useState<PartUsed[]>([]);
  const [dateText, setDateText] = useState(todayText());
  const [hoursText, setHoursText] = useState(String(asset.currentHours));
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);

  const scheduled = useMemo(() => {
    const now = new Date();
    return tasks.map((t) => computeDue(t, asset, now)).sort((a, b) => a.urgency - b.urgency);
  }, [tasks, asset]);

  const toggleTask = (task: ServiceTask) => {
    const isOn = completed.includes(task.id);
    setCompleted((c) => (isOn ? c.filter((id) => id !== task.id) : [...c, task.id]));
    // Fill the title from the first ticked service if it is still empty.
    if (!isOn && !title.trim()) setTitle(task.name);
  };

  const addFilterAsPart = (label: string, partNumber: string) =>
    setParts((p) => [...p, { name: label, partNumber, quantity: '1' }]);

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
    setDescription('');
    setParts([]);
    setNotes('');
    setCompleted([]);
  };

  return (
    <Card>
      <Field
        label="Service done by"
        placeholder="Name"
        value={performedBy}
        onChangeText={setPerformedBy}
        autoCapitalize="words"
      />

      {scheduled.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>Scheduled services completed</Text>
          {scheduled.map((d) => (
            <CheckRow
              key={d.task.id}
              checked={completed.includes(d.task.id)}
              onToggle={() => toggleTask(d.task)}
              title={d.task.name}
              detail={d.detail}
              detailColor={
                d.status === 'overdue' ? colors.danger : d.status === 'dueSoon' ? colors.warn : undefined
              }
            />
          ))}
        </View>
      )}

      <Field
        label="Service"
        placeholder="e.g. Engine oil and filter"
        value={title}
        onChangeText={setTitle}
      />
      <Field
        label="Description"
        placeholder="What was done, what was found"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={styles.block}>
        <Text style={styles.label}>Parts used</Text>
        {asset.specs.filters.length > 0 && (
          <View style={styles.quickRow}>
            {asset.specs.filters.map((f, i) => (
              <Pressable
                key={i}
                onPress={() => addFilterAsPart(f.label, f.partNumber)}
                style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${f.label} ${f.partNumber}`}
              >
                <Text style={styles.quickText}>+ {f.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {parts.map((p, i) => (
          <View key={i} style={styles.partRow}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Part"
              placeholderTextColor={colors.muted}
              value={p.name}
              onChangeText={(v) => setPart(i, { name: v })}
            />
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Part #"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              value={p.partNumber}
              onChangeText={(v) => setPart(i, { partNumber: v })}
            />
            <TextInput
              style={[styles.input, { width: 56, textAlign: 'center' }]}
              placeholder="Qty"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={p.quantity}
              onChangeText={(v) => setPart(i, { quantity: v })}
            />
            <Button
              title="✕"
              variant="danger"
              style={{ width: touch, paddingHorizontal: 0 }}
              onPress={() => setParts((x) => x.filter((_, j) => j !== i))}
            />
          </View>
        ))}
        <Button title="+ Add part" variant="secondary" onPress={() => setParts((p) => [...p, emptyPart()])} />
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Field
            label="Date (YYYY-MM-DD)"
            value={dateText}
            onChangeText={setDateText}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Hours at service"
            value={hoursText}
            onChangeText={setHoursText}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Field
        label="Notes"
        placeholder="Anything else (next service, issues found)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Button title="Save service" onPress={submit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quick: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  quickText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  partRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  input: {
    minHeight: touch,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
});
