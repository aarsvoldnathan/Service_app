import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, spacing, touch, useStyles } from '../theme';
import { Asset, AssetSpecs, Category, FilterSpec } from '../types';
import { Button, Card, Field, Input } from './ui';

type Props = {
  asset: Asset;
  category: Category;
  onSave: (specs: AssetSpecs) => void;
};

/** Spec values for the machine's category plus its saved parts list. */
export function SpecsCard({ asset, category, onSave }: Props) {
  const s = useStyles(makeStyles);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AssetSpecs>(asset.specs);

  const startEdit = () => {
    setDraft({ values: { ...asset.specs.values }, filters: asset.specs.filters.map((f) => ({ ...f })) });
    setEditing(true);
  };

  const save = () => {
    const filters = draft.filters
      .map((f) => ({ label: f.label.trim(), partNumber: f.partNumber.trim() }))
      .filter((f) => f.label || f.partNumber);
    const values: Record<string, string> = {};
    Object.entries(draft.values).forEach(([k, v]) => {
      if (v.trim()) values[k] = v.trim();
    });
    onSave({ values, filters });
    setEditing(false);
  };

  const setFilter = (index: number, patch: Partial<FilterSpec>) =>
    setDraft((d) => ({ ...d, filters: d.filters.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));

  if (editing) {
    return (
      <Card>
        <Text style={s.catName}>{category.name}</Text>
        {category.fields.map((f) => (
          <Field
            key={f.id}
            label={f.label}
            placeholder={f.placeholder}
            value={draft.values[f.id] ?? ''}
            onChangeText={(v) => setDraft((d) => ({ ...d, values: { ...d.values, [f.id]: v } }))}
          />
        ))}
        <Text style={s.label}>Saved parts and part numbers</Text>
        {draft.filters.map((f, i) => (
          <View key={i} style={s.filterEditRow}>
            <Input style={{ flex: 1 }} placeholder="Part (e.g. Oil filter)" value={f.label} onChangeText={(v) => setFilter(i, { label: v })} />
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
              accessibilityLabel="Remove part"
              onPress={() => setDraft((d) => ({ ...d, filters: d.filters.filter((_, j) => j !== i) }))}
            />
          </View>
        ))}
        <Button
          title="+ Add part"
          variant="secondary"
          onPress={() => setDraft((d) => ({ ...d, filters: [...d.filters, { label: '', partNumber: '' }] }))}
        />
        <Text style={s.note}>Change which spec lines appear in Settings › Equipment categories.</Text>
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
      <Text style={s.catName}>{category.name}</Text>
      <View style={s.grid}>
        {category.fields.map((f) => (
          <View key={f.id} style={s.cell}>
            <Text style={s.cellLabel}>{f.label}</Text>
            <Text style={[s.cellValue, !specs.values[f.id] && s.missing]}>{specs.values[f.id] || 'Not set'}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.cellLabel, { marginTop: spacing.sm }]}>Saved parts and part numbers</Text>
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
    catName: { color: c.accent, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
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
