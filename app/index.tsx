import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AssignmentCard } from '../src/components/AssignmentCard';
import { DueRow } from '../src/components/DueRow';
import { HoursRow } from '../src/components/HoursRow';
import { Tile } from '../src/components/Tile';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { Button, HeaderButton, ListRow, Muted, SectionTitle } from '../src/components/ui';
import { getDueList, getRecentLogs, getStaleAssets, machineStatus } from '../src/maintenance';
import { useStore } from '../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

export default function Dashboard() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const {
    ready, fleets, activeFleet, fleetAssets, tasks, logs, assignments, thresholds, prefs,
    updateHours, setPrefs, technicianName, shopping, jobs,
  } = useStore();
  const [fleetMenu, setFleetMenu] = useState(false);

  if (!ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  const now = new Date();
  const ids = new Set(fleetAssets.map((a) => a.id));
  const due = getDueList(fleetAssets, tasks, now, thresholds);
  const overdue = due.filter((d) => d.status === 'overdue');
  const needing = fleetAssets.filter((a) => machineStatus(a, tasks, now, thresholds).level !== 'green');
  const stale = getStaleAssets(fleetAssets, now, activeFleet.staleHoursDays);
  const recent = getRecentLogs(logs.filter((l) => ids.has(l.assetId)), now, 30);
  const open = assignments.filter((a) => a.status === 'open' && ids.has(a.assetId));
  const mine = open.filter((a) => a.technicianId === prefs.meTechnicianId || !a.technicianId);
  const others = open.filter((a) => !mine.includes(a));
  const assetName = (id: string) => fleetAssets.find((a) => a.id === id)?.name ?? 'Unknown';

  const openService = (assetId?: string) =>
    router.push(assetId ? { pathname: '/service', params: { assetId } } : '/service');
  const openMachine = (id: string) => router.push({ pathname: '/machine/[id]', params: { id } });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={() => setFleetMenu(true)}
              accessibilityRole="button"
              accessibilityLabel={`Fleet: ${activeFleet.name}. Change fleet`}
              hitSlop={8}
              style={s.fleetButton}
            >
              <Text style={s.fleetName} numberOfLines={1}>
                {activeFleet.name}
              </Text>
              <Text style={s.fleetCaret}>▾</Text>
            </Pressable>
          ),
          headerRight: () => <HeaderButton title="⚙ Settings" label="Settings" onPress={() => router.push('/settings')} />,
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <UpdateBanner />
        <View style={s.tiles}>
          <Tile label="Need service" value={needing.length} color={needing.length ? c.danger : c.ok} onPress={() => router.push('/status')} />
          <Tile label="Overdue items" value={overdue.length} color={c.orange} onPress={() => router.push('/status')} />
          <Tile label="Hours stale" value={stale.length} color={c.warn} />
        </View>

        <Button title="Log a service" onPress={() => openService()} style={{ marginBottom: spacing.sm }} />
        <View style={s.grid}>
          <Button title="Fleet status" variant="secondary" style={s.gridItem} onPress={() => router.push('/status')} />
          <Button
            title="Find / scan"
            variant="secondary"
            style={s.gridItem}
            onPress={() => router.push({ pathname: '/find', params: { next: 'service' } })}
          />
          <Button
            title={`Shopping list (${shopping.filter((i) => !i.purchased && i.fleetId === activeFleet.id).length})`}
            variant="secondary"
            style={s.gridItem}
            onPress={() => router.push('/shopping')}
          />
          <Button
            title={`Jobs & time (${jobs.filter((j) => j.status !== 'paid').length})`}
            variant="secondary"
            style={s.gridItem}
            onPress={() => router.push('/jobs')}
          />
        </View>

        {(mine.length > 0 || others.length > 0) && (
          <View style={s.section}>
            <SectionTitle>Assigned work</SectionTitle>
            {[...mine, ...others].map((a) => (
              <AssignmentCard key={a.id} assignment={a} showMachine compact onOpen={() => openMachine(a.assetId)} />
            ))}
          </View>
        )}

        <View style={s.section}>
          <SectionTitle>Maintenance due</SectionTitle>
          {due.length === 0 ? (
            <Muted>Nothing due. All equipment is up to date.</Muted>
          ) : (
            due.map((d) => <DueRow key={d.task.id} item={d} onPress={() => openService(d.asset.id)} />)
          )}
        </View>

        <View style={s.section}>
          <SectionTitle>Hours to update</SectionTitle>
          {stale.length === 0 ? (
            <Muted>All hours were updated in the last {activeFleet.staleHoursDays} days.</Muted>
          ) : (
            stale.map((a) => <HoursRow key={a.id} asset={a} now={now} onSave={updateHours} />)
          )}
        </View>

        <View style={s.section}>
          <SectionTitle>Maintenance done (last 30 days)</SectionTitle>
          {recent.length === 0 ? (
            <Muted>No services logged in the last 30 days.</Muted>
          ) : (
            recent.map((l) => (
              <View key={l.id} style={s.logRow}>
                <Text style={s.logTask}>{l.taskName}</Text>
                <Text style={s.logMeta}>
                  {assetName(l.assetId)} · {l.hoursAtService} h
                </Text>
                <Text style={s.logMeta}>
                  {l.performedBy} · {new Date(l.date).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Fleet drop-down */}
      <Modal visible={fleetMenu} transparent animationType="fade" onRequestClose={() => setFleetMenu(false)}>
        <Pressable style={s.backdrop} onPress={() => setFleetMenu(false)} accessibilityLabel="Close fleet menu">
          <Pressable style={s.menu} onPress={() => {}}>
            <Text style={s.menuTitle}>Switch fleet</Text>
            {fleets.map((f) => (
              <ListRow
                key={f.id}
                title={`${f.name}${f.id === activeFleet.id ? '  ✓' : ''}`}
                subtitle={`${f.kind === 'work' ? 'Work' : 'Home'} · ${f.memberIds.map((m) => technicianName(m)).join(', ') || 'No members'}`}
                onPress={() => {
                  setPrefs({ activeFleetId: f.id });
                  setFleetMenu(false);
                }}
              />
            ))}
            <Button
              title="Manage fleets"
              variant="secondary"
              onPress={() => {
                setFleetMenu(false);
                router.push('/settings/fleets');
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    content: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
    tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    gridItem: { flexBasis: '47%', flexGrow: 1 },
    section: { marginBottom: spacing.lg },
    fleetButton: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 220 },
    fleetName: { color: c.text, fontSize: 18, fontWeight: '800' },
    fleetCaret: { color: c.accent, fontSize: 16, fontWeight: '800' },
    logRow: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderLeftWidth: 5,
      borderLeftColor: c.ok,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    logTask: { color: c.text, fontSize: 17, fontWeight: '700' },
    logMeta: { color: c.muted, fontSize: 14, marginTop: 2 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 100, paddingHorizontal: spacing.md },
    menu: { backgroundColor: c.bg, borderRadius: radius, padding: spacing.md, borderWidth: 1, borderColor: c.border },
    menuTitle: { color: c.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  });
