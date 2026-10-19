import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ChipSelect, SectionTitle } from '../../src/components/ui';
import { useStore } from '../../src/store';
import { TEMPLATES, templateLabel } from '../../src/templates';
import { Palette, radius, spacing, useStyles } from '../../src/theme';

/** Add several machines at once from factory schedule templates. */
export default function QuickAddScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ fleetId?: string }>();
  const { fleets, activeFleet, quickAdd } = useStore();
  const [fleetId, setFleetId] = useState(params.fleetId ?? activeFleet.id);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const change = (id: string, delta: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(50, (c[id] ?? 0) + delta)) }));

  const add = () => {
    const n = quickAdd(fleetId, counts);
    Alert.alert(
      `${n} machine${n === 1 ? '' : 's'} added`,
      'Each has its factory schedule. Open each machine in Settings › Machines to enter its serial number, hours and barcode.',
    );
    router.back();
  };

  const types = Array.from(new Set(TEMPLATES.map((t) => t.type)));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Quick add models' }} />
      <ScrollView contentContainerStyle={s.content}>
        <SectionTitle>Add to fleet</SectionTitle>
        <View style={{ marginBottom: spacing.lg }}>
          <ChipSelect options={fleets.map((f) => ({ value: f.id, label: f.name }))} value={fleetId} onChange={setFleetId} />
        </View>

        {types.map((type) => (
          <View key={type} style={{ marginBottom: spacing.md }}>
            <SectionTitle>{type}s</SectionTitle>
            {TEMPLATES.filter((t) => t.type === type).map((t) => {
              const n = counts[t.id] ?? 0;
              return (
                <View key={t.id} style={[s.row, n > 0 && s.rowOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{templateLabel(t)}</Text>
                    <Text style={s.sub}>
                      {t.items.length} service items{t.verified ? '' : ' · confirm intervals on decal'}
                    </Text>
                  </View>
                  <Button title="−" variant="secondary" style={s.step} onPress={() => change(t.id, -1)} accessibilityLabel={`One fewer ${templateLabel(t)}`} />
                  <Text style={s.count}>{n}</Text>
                  <Button title="+" variant="secondary" style={s.step} onPress={() => change(t.id, 1)} accessibilityLabel={`One more ${templateLabel(t)}`} />
                </View>
              );
            })}
          </View>
        ))}

        <Button title={total ? `Add ${total} machine${total === 1 ? '' : 's'}` : 'Choose how many of each'} disabled={!total} onPress={add} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius,
      marginBottom: spacing.sm,
    },
    rowOn: { borderColor: c.accent },
    name: { color: c.text, fontSize: 17, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 13, marginTop: 2 },
    step: { width: 48, paddingHorizontal: 0 },
    count: { color: c.text, fontSize: 20, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  });
