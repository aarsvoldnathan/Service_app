import { Stack } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DueRow } from '../src/components/DueRow';
import { HoursRow } from '../src/components/HoursRow';
import { Tile } from '../src/components/Tile';
import { getDueList, getRecentLogs, getStaleAssets } from '../src/maintenance';
import { useStore } from '../src/store';
import { colors, spacing } from '../src/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export default function Dashboard() {
  const { ready, assets, tasks, logs, updateHours } = useStore();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const now = new Date();
  const due = getDueList(assets, tasks, now);
  const overdue = due.filter((d) => d.status === 'overdue');
  const dueSoon = due.filter((d) => d.status === 'dueSoon');
  const stale = getStaleAssets(assets, now);
  const recent = getRecentLogs(logs, now, 30);
  const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? 'Unknown';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Service Ceo' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tiles}>
          <Tile label="Overdue" value={overdue.length} color={colors.danger} />
          <Tile label="Due soon" value={dueSoon.length} color={colors.warn} />
          <Tile label="Hours stale" value={stale.length} color={colors.accent} />
        </View>

        <Section title="Maintenance due">
          {due.length === 0 ? (
            <Empty text="Nothing due. All equipment is up to date." />
          ) : (
            due.map((d) => <DueRow key={d.task.id} item={d} />)
          )}
        </Section>

        <Section title="Hours to update">
          {stale.length === 0 ? (
            <Empty text="All equipment hours were updated this week." />
          ) : (
            stale.map((a) => (
              <HoursRow key={a.id} asset={a} now={now} onSave={updateHours} />
            ))
          )}
        </Section>

        <Section title="Maintenance done (last 30 days)">
          {recent.length === 0 ? (
            <Empty text="No services logged in the last 30 days." />
          ) : (
            recent.map((l) => (
              <View key={l.id} style={styles.logRow}>
                <Text style={styles.logTask}>{l.taskName}</Text>
                <Text style={styles.logMeta}>
                  {assetName(l.assetId)} · {l.hoursAtService} h
                </Text>
                <Text style={styles.logMeta}>
                  {l.performedBy} · {new Date(l.date).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  empty: { color: colors.muted, fontSize: 15, paddingVertical: spacing.sm },
  logRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderLeftColor: colors.ok,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logTask: { color: colors.text, fontSize: 17, fontWeight: '700' },
  logMeta: { color: colors.muted, fontSize: 14, marginTop: 2 },
});
