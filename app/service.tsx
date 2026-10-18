import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ServiceForm } from '../src/components/ServiceForm';
import { SpecsCard } from '../src/components/SpecsCard';
import { Card, SectionTitle } from '../src/components/ui';
import { useStore } from '../src/store';
import { colors, radius, spacing, touch } from '../src/theme';

export default function ServiceScreen() {
  const params = useLocalSearchParams<{ assetId?: string }>();
  const { assets, tasks, logs, addServiceLog, updateSpecs } = useStore();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    params.assetId ?? assets[0]?.id,
  );

  const asset = assets.find((a) => a.id === selectedId) ?? assets[0];
  const assetTasks = asset ? tasks.filter((t) => t.assetId === asset.id) : [];
  const history = asset
    ? logs.filter((l) => l.assetId === asset.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Log service' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Vehicle picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.picker}
        >
          {assets.map((a) => {
            const active = a.id === asset?.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => setSelectedId(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!asset ? (
          <Text style={styles.empty}>No equipment yet.</Text>
        ) : (
          <>
            {/* Vehicle header */}
            <View style={styles.header}>
              <Text style={styles.name}>{asset.name}</Text>
              <Text style={styles.serial} selectable>
                Serial: {asset.serial}
              </Text>
              <Text style={styles.serial}>Current hours: {asset.currentHours} h</Text>
            </View>

            <View style={styles.section}>
              <SectionTitle>Service specs</SectionTitle>
              <SpecsCard
                key={asset.id}
                asset={asset}
                onSave={(specs) => updateSpecs(asset.id, specs)}
              />
            </View>

            <View style={styles.section}>
              <SectionTitle>Log a service</SectionTitle>
              <ServiceForm
                key={asset.id}
                asset={asset}
                tasks={assetTasks}
                onSubmit={addServiceLog}
              />
            </View>

            <View style={styles.section}>
              <SectionTitle>Service history</SectionTitle>
              {history.length === 0 ? (
                <Text style={styles.empty}>No services logged for this vehicle yet.</Text>
              ) : (
                history.map((l) => (
                  <Card key={l.id} style={styles.logCard}>
                    <Text style={styles.logTitle}>{l.taskName}</Text>
                    <Text style={styles.logMeta}>
                      {new Date(l.date).toLocaleDateString()} · {l.hoursAtService} h · {l.performedBy}
                    </Text>
                    {l.description ? <Text style={styles.logBody}>{l.description}</Text> : null}
                    {l.parts && l.parts.length > 0 ? (
                      <View style={{ marginTop: spacing.sm }}>
                        {l.parts.map((p, i) => (
                          <Text key={i} style={styles.logPart}>
                            {p.quantity ? `${p.quantity} × ` : ''}
                            {p.name}
                            {p.partNumber ? `  ${p.partNumber}` : ''}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {l.notes ? <Text style={styles.logNotes}>{l.notes}</Text> : null}
                  </Card>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
  picker: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    minHeight: touch - 8,
    maxWidth: 240,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chipTextActive: { color: '#1A1200' },
  header: { marginBottom: spacing.lg },
  name: { color: colors.text, fontSize: 26, fontWeight: '800' },
  serial: { color: colors.muted, fontSize: 16, marginTop: 4 },
  section: { marginBottom: spacing.lg },
  empty: { color: colors.muted, fontSize: 15, paddingVertical: spacing.sm },
  logCard: { marginBottom: spacing.sm, borderLeftWidth: 5, borderLeftColor: colors.ok },
  logTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  logMeta: { color: colors.muted, fontSize: 14, marginTop: 2 },
  logBody: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  logPart: { color: colors.accent, fontSize: 14, marginTop: 2 },
  logNotes: { color: colors.muted, fontSize: 14, marginTop: spacing.sm, fontStyle: 'italic' },
});
