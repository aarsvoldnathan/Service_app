import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Proposal } from '../ai';
import { useStore } from '../store';
import { scheduleFromTemplate } from '../templates';
import { Palette, radius, spacing, useStyles } from '../theme';
import { Asset } from '../types';
import { Button, CheckRow } from './ui';

/** AI suggestions with a checkbox per line; nothing changes until "Apply". */
export function ProposalCard({ asset, proposal, onApplied }: { asset: Asset; proposal: Proposal; onApplied?: () => void }) {
  const s = useStyles(makeStyles);
  const { tasks, categoryOf, updateSpecs, saveAsset, saveTask, deleteTask } = useStore();
  const category = categoryOf(asset);
  const specs = proposal.specs ?? [];
  const parts = proposal.parts ?? [];
  const schedule = proposal.schedule ?? [];
  const keys = [...specs.map((_, i) => `s${i}`), ...parts.map((_, i) => `p${i}`), ...schedule.map((_, i) => `t${i}`)];
  const [on, setOn] = useState<Set<string>>(new Set(keys));
  const [replace, setReplace] = useState(false);
  const [applied, setApplied] = useState(false);
  const toggle = (k: string) =>
    setOn((x) => {
      const n = new Set(x);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const fieldLabel = (id?: string) => category.fields.find((f) => f.id === id)?.label;
  const existingTasks = tasks.filter((t) => t.assetId === asset.id);
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  const apply = () => {
    // Specs: matching fields go into the spec card, anything else into the machine's notes.
    const values = { ...asset.specs.values };
    const extra: string[] = [];
    specs.forEach((sp, i) => {
      if (!on.has(`s${i}`)) return;
      if (sp.field_id && fieldLabel(sp.field_id)) values[sp.field_id] = sp.value;
      else extra.push(`${sp.label}: ${sp.value}`);
    });
    const filters = [...asset.specs.filters];
    parts.forEach((p, i) => {
      if (on.has(`p${i}`) && !filters.some((f) => f.partNumber.trim().toUpperCase() === p.part_number.trim().toUpperCase())) {
        filters.push({ label: p.label, partNumber: p.part_number });
      }
    });
    updateSpecs(asset.id, { values, filters });
    if (extra.length) {
      saveAsset({ ...asset, specs: { values, filters }, notes: [asset.notes, ...extra].filter(Boolean).join('\n') });
    }

    // Schedule: update items with the same name, add new ones (or replace everything).
    const chosen = schedule.filter((_, i) => on.has(`t${i}`));
    if (replace && chosen.length) existingTasks.forEach((t) => deleteTask(t.id));
    chosen.forEach((item) => {
      if (!item.interval_hours && !item.interval_days) return;
      const base = scheduleFromTemplate(
        { name: item.name, kind: item.kind, hours: item.interval_hours, days: item.interval_days, firstAt: item.first_at_hours, notes: item.notes },
        asset.currentHours,
      );
      const match = replace ? undefined : existingTasks.find((t) => sameName(t.name, item.name));
      saveTask(
        match
          ? { ...match, kind: base.kind, intervalHours: base.intervalHours, intervalDays: base.intervalDays, notes: base.notes ?? match.notes }
          : { ...base, assetId: asset.id },
      );
    });
    setApplied(true);
    onApplied?.();
    Alert.alert('Applied', 'The selected specs, parts and schedule items were saved to this machine.');
  };

  if (!specs.length && !parts.length && !schedule.length) return null;

  return (
    <View style={s.card}>
      <Text style={s.title}>Suggested updates</Text>
      {proposal.summary ? <Text style={s.body}>{proposal.summary}</Text> : null}

      {specs.length > 0 && <Text style={s.section}>Service specs</Text>}
      {specs.map((sp, i) => (
        <CheckRow
          key={`s${i}`}
          checked={on.has(`s${i}`)}
          onToggle={() => toggle(`s${i}`)}
          title={`${fieldLabel(sp.field_id) ?? sp.label}: ${sp.value}`}
          detail={
            sp.field_id && asset.specs.values[sp.field_id]
              ? `Now: ${asset.specs.values[sp.field_id]}`
              : sp.field_id && fieldLabel(sp.field_id)
                ? undefined
                : 'Added to machine notes'
          }
        />
      ))}

      {parts.length > 0 && <Text style={s.section}>Parts</Text>}
      {parts.map((p, i) => (
        <CheckRow key={`p${i}`} checked={on.has(`p${i}`)} onToggle={() => toggle(`p${i}`)} title={`${p.label}: ${p.part_number}`} />
      ))}

      {schedule.length > 0 && <Text style={s.section}>Maintenance schedule</Text>}
      {schedule.map((t, i) => {
        const every = [t.interval_hours && `${t.interval_hours} h`, t.interval_days && `${t.interval_days} days`].filter(Boolean).join(' or ');
        const exists = existingTasks.some((x) => sameName(x.name, t.name));
        return (
          <CheckRow
            key={`t${i}`}
            checked={on.has(`t${i}`)}
            onToggle={() => toggle(`t${i}`)}
            title={t.name}
            detail={[
              `${t.kind === 'routine' ? 'Routine' : 'Scheduled'} · every ${every || '?'}`,
              t.first_at_hours ? `first at ${t.first_at_hours} h` : '',
              !replace && exists ? 'updates existing item' : '',
              t.notes ?? '',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        );
      })}
      {schedule.length > 0 && existingTasks.length > 0 && (
        <CheckRow
          checked={replace}
          onToggle={() => setReplace((r) => !r)}
          title="Replace the current schedule"
          detail={`Removes the ${existingTasks.length} current items first. Leave off to keep them and add/update.`}
        />
      )}

      {proposal.caveats ? <Text style={s.caveat}>Check: {proposal.caveats}</Text> : null}
      <Button
        title={applied ? 'Applied ✓' : `Apply ${on.size} selected`}
        disabled={applied || on.size === 0}
        onPress={apply}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { borderWidth: 2, borderColor: c.accent, borderRadius: radius, padding: spacing.md, backgroundColor: c.card, marginTop: spacing.sm },
    title: { color: c.accent, fontSize: 16, fontWeight: '800' },
    body: { color: c.text, fontSize: 14, marginTop: spacing.xs },
    section: { color: c.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md },
    caveat: { color: c.warn, fontSize: 13, marginTop: spacing.sm },
  });
