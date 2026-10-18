import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, touch } from '../theme';
import { Asset, AssetSpecs, FilterSpec } from '../types';
import { Button, Card, Field } from './ui';

type Props = {
  asset: Asset;
  onSave: (specs: AssetSpecs) => void;
};

const ROWS: { key: Exclude<keyof AssetSpecs, 'filters'>; label: string; placeholder: string }[] = [
  { key: 'lugNutTorque', label: 'Lug nut torque', placeholder: 'e.g. 120 ft-lb' },
  { key: 'tirePressure', label: 'Tire pressure', placeholder: 'e.g. Front 35 / Rear 40 psi' },
  { key: 'oilCapacity', label: 'Oil capacity', placeholder: 'e.g. 6.5 qt with filter' },
  { key: 'oilType', label: 'Oil type', placeholder: 'e.g. 15W-40' },
];

export function SpecsCard({ asset, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AssetSpecs>(asset.specs);

  const startEdit = () => {
    setDraft({ ...asset.specs, filters: asset.specs.filters.map((f) => ({ ...f })) });
    setEditing(true);
  };

  const save = () => {
    const filters = draft.filters
      .map((f) => ({ label: f.label.trim(), partNumber: f.partNumber.trim() }))
      .filter((f) => f.label || f.partNumber);
    onSave({ ...draft, filters });
    setEditing(false);
  };

  const setFilter = (index: number, patch: Partial<FilterSpec>) =>
    setDraft((d) => ({
      ...d,
      filters: d.filters.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));

  if (editing) {
    return (
      <Card>
        {ROWS.map((r) => (
          <Field
            key={r.key}
            label={r.label}
            placeholder={r.placeholder}
            value={draft[r.key] ?? ''}
            onChangeText={(v) => setDraft((d) => ({ ...d, [r.key]: v }))}
          />
        ))}
        <Text style={styles.label}>Filters and part numbers</Text>
        {draft.filters.map((f, i) => (
          <View key={i} style={styles.filterEditRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Filter (e.g. Oil filter)"
              placeholderTextColor={colors.muted}
              value={f.label}
              onChangeText={(v) => setFilter(i, { label: v })}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Part number"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              value={f.partNumber}
              onChangeText={(v) => setFilter(i, { partNumber: v })}
            />
            <Button
              title="✕"
              variant="danger"
              style={{ width: touch }}
              onPress={() =>
                setDraft((d) => ({ ...d, filters: d.filters.filter((_, j) => j !== i) }))
              }
            />
          </View>
        ))}
        <Button
          title="+ Add filter"
          variant="secondary"
          onPress={() =>
            setDraft((d) => ({ ...d, filters: [...d.filters, { label: '', partNumber: '' }] }))
          }
        />
        <View style={styles.actions}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <Button title="Save specs" style={{ flex: 1 }} onPress={save} />
        </View>
      </Card>
    );
  }

  const { specs } = asset;
  return (
    <Card>
      <View style={styles.grid}>
        {ROWS.map((r) => (
          <View key={r.key} style={styles.cell}>
            <Text style={styles.cellLabel}>{r.label}</Text>
            <Text style={[styles.cellValue, !specs[r.key] && styles.missing]}>
              {specs[r.key] || 'Not set'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.cellLabel, { marginTop: spacing.sm }]}>Filters and part numbers</Text>
      {specs.filters.length === 0 ? (
        <Text style={[styles.cellValue, styles.missing]}>None added</Text>
      ) : (
        specs.filters.map((f, i) => (
          <View key={i} style={styles.filterRow}>
            <Text style={styles.filterLabel}>{f.label}</Text>
            <Text style={styles.partNumber} selectable>
              {f.partNumber}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.note}>Always confirm specs against the operator's manual.</Text>
      <Button title="Edit specs" variant="secondary" onPress={startEdit} style={{ marginTop: spacing.sm }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { width: '50%', paddingHorizontal: spacing.xs, marginBottom: spacing.md },
  cellLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  cellValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  missing: { color: colors.muted, fontWeight: '400' },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterLabel: { color: colors.text, fontSize: 16 },
  partNumber: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  filterEditRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
