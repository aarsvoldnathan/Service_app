import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, spacing, touch, useStyles } from '../theme';
import { Asset, AssetSpecs, FilterSpec } from '../types';
import { Button, Card, Field, Input } from './ui';

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
  const s = useStyles(makeStyles);
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
    setDraft((d) => ({ ...d, filters: d.filters.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));

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
        <Text style={s.label}>Filters and part numbers</Text>
        {draft.filters.map((f, i) => (
          <View key={i} style={s.filterEditRow}>
            <Input style={{ flex: 1 }} placeholder="Filter (e.g. Oil filter)" value={f.label} onChangeText={(v) => setFilter(i, { label: v })} />
            <Input
              style={{ flex: 1 }}
              placeholder="Part number"
              autoCapitalize="characters"
              value={f.partNumber}
              onChangeText={(v) => setFilter(i, { partNumber: v })}
            />
            <Button
              title="✕"
              variant="danger"
              style={{ width: touch, paddingHorizontal: 0 }}
              accessibilityLabel="Remove filter"
              onPress={() => setDraft((d) => ({ ...d, filters: d.filters.filter((_, j) => j !== i) }))}
            />
          </View>
        ))}
        <Button
          title="+ Add filter"
          variant="secondary"
          onPress={() => setDraft((d) => ({ ...d, filters: [...d.filters, { label: '', partNumber: '' }] }))}
        />
        <View style={s.actions}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <Button title="Save specs" style={{ flex: 1 }} onPress={save} />
        </View>
      </Card>
    );
  }

  const { specs } = asset;
  return (
    <Card>
      <View style={s.grid}>
        {ROWS.map((r) => (
          <View key={r.key} style={s.cell}>
            <Text style={s.cellLabel}>{r.label}</Text>
            <Text style={[s.cellValue, !specs[r.key] && s.missing]}>{specs[r.key] || 'Not set'}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.cellLabel, { marginTop: spacing.sm }]}>Filters and part numbers</Text>
      {specs.filters.length === 0 ? (
        <Text style={[s.cellValue, s.missing]}>None added</Text>
      ) : (
        specs.filters.map((f, i) => (
          <View key={i} style={s.filterRow}>
            <Text style={s.filterLabel}>{f.label}</Text>
            <Text style={s.partNumber} selectable>
              {f.partNumber}
            </Text>
          </View>
        ))
      )}
      {asset.notes ? <Text style={s.assetNotes}>{asset.notes}</Text> : null}
      <Text style={s.note}>Always confirm specs against the operator's manual.</Text>
      <Button title="Edit specs" variant="secondary" onPress={startEdit} style={{ marginTop: spacing.sm }} />
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
    cell: { width: '50%', paddingHorizontal: spacing.xs, marginBottom: spacing.md },
    cellLabel: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    cellValue: { color: c.text, fontSize: 17, fontWeight: '700' },
    missing: { color: c.muted, fontWeight: '400' },
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    filterLabel: { color: c.text, fontSize: 16, flexShrink: 1 },
    partNumber: { color: c.accent, fontSize: 16, fontWeight: '800' },
    assetNotes: { color: c.text, fontSize: 14, marginTop: spacing.sm },
    note: { color: c.muted, fontSize: 12, marginTop: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    filterEditRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
