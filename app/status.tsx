import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChipSelect, levelColor, Muted } from '../src/components/ui';
import { Level, LEVEL_LABEL, LEVEL_RANK, machineStatus } from '../src/maintenance';
import { useStore } from '../src/store';
import { font, Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

type Filter = 'all' | 'needs';

export default function StatusScreen({ embedded }: { embedded?: boolean } = {}) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { fleetAssets, tasks, assignments, thresholds, activeFleet, technicianName } = useStore();
  const [filter, setFilter] = useState<Filter>('all');

  const now = new Date();
  const rows = fleetAssets
    .map((a) => machineStatus(a, tasks, now, thresholds))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.asset.name.localeCompare(b.asset.name))
    .filter((r) => filter === 'all' || r.level !== 'green');

  const counts = (['red', 'orange', 'yellow', 'green'] as Level[]).map((l) => ({
    level: l,
    n: fleetAssets.filter((a) => machineStatus(a, tasks, now, thresholds).level === l).length,
  }));

  return (
    <View style={{ flex: 1 }}>
      {embedded ? null : <Stack.Screen options={{ title: `${activeFleet.name} status` }} />}
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.legend}>
          {counts.map(({ level, n }) => (
            <View key={level} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: levelColor(c, level) }]} />
              <Text style={s.legendN}>{n}</Text>
            </View>
          ))}
        </View>
        <Text style={s.key}>
          Green good · Yellow routine care due or service coming up · Orange routine care {thresholds.orangeOverdueHours}+ h
          overdue · Red scheduled service overdue
        </Text>

        <View style={{ marginBottom: spacing.md }}>
          <ChipSelect
            options={[
              { value: 'all', label: 'All machines' },
              { value: 'needs', label: 'Needs attention' },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
          />
        </View>

        {rows.length === 0 ? (
          <Muted>{filter === 'needs' ? 'Every machine is in good shape.' : 'No machines in this fleet yet.'}</Muted>
        ) : (
          rows.map((r) => {
            const color = levelColor(c, r.level);
            const open = assignments.filter((x) => x.assetId === r.asset.id && x.status === 'open');
            return (
              <Pressable
                key={r.asset.id}
                onPress={() => router.push({ pathname: '/machine/[id]', params: { id: r.asset.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${r.asset.name}, ${LEVEL_LABEL[r.level]}`}
                style={({ pressed }) => [s.row, { borderLeftColor: color }, pressed && { opacity: 0.7 }]}
              >
                <View style={s.rowHead}>
                  <View style={[s.badge, { backgroundColor: color }]} />
                  <Text style={s.name} numberOfLines={1}>
                    {r.asset.name}
                  </Text>
                  <Text style={s.hours}>{r.asset.currentHours} h</Text>
                </View>
                <Text style={[s.level, { color }]}>{LEVEL_LABEL[r.level]}</Text>
                {r.needs.slice(0, 3).map((d) => (
                  <Text key={d.task.id} style={s.need}>
                    • {d.task.name}: <Text style={{ color: levelColor(c, d.level) }}>{d.detail}</Text>
                  </Text>
                ))}
                {r.needs.length > 3 ? <Text style={s.more}>+ {r.needs.length - 3} more</Text> : null}
                {open.length > 0 ? (
                  <Text style={s.assigned}>
                    Assigned: {open.map((x) => (x.technicianId ? technicianName(x.technicianId) : 'Note to self')).join(', ')}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 5 },
    legend: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    legendItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      paddingVertical: spacing.sm,
    },
    legendDot: { width: 14, height: 14, borderRadius: 7 },
    legendN: { color: c.text, fontSize: 24, fontFamily: font.headingBold },
    key: { color: c.muted, fontSize: 12, fontFamily: font.light, marginBottom: spacing.md },
    row: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderLeftWidth: 8,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    badge: { width: 14, height: 14, borderRadius: 7 },
    name: { color: c.text, fontSize: 20, fontFamily: font.heading, flex: 1 },
    hours: { color: c.muted, fontSize: 15, fontFamily: font.regular },
    level: { fontSize: 14, fontFamily: font.headingMedium, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 },
    need: { color: c.text, fontSize: 14, fontFamily: font.light, marginTop: 2 },
    more: { color: c.muted, fontSize: 13, marginTop: 2 },
    assigned: { color: c.accent, fontSize: 14, fontWeight: '700', marginTop: spacing.sm },
  });
