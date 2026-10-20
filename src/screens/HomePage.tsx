import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignmentCard } from '../components/AssignmentCard';
import { HoursRow } from '../components/HoursRow';
import { Tile } from '../components/Tile';
import { UpdateBanner } from '../components/UpdateBanner';
import { Button, levelColor, Muted, SectionTitle } from '../components/ui';
import { DueInfo, getDueList, getRecentLogs, getStaleAssets, machineStatus } from '../maintenance';
import { useStore } from '../store';
import { font, Palette, radius, spacing, useStyles, useTheme } from '../theme';

const DUE_SHOWN = 6;

/** "Overdue by 12 h" -> "12 h over"; "Due in 3 days" -> "3 days". */
const brief = (d: DueInfo) => d.detail.replace(/^Overdue by (.+)$/i, '$1 over').replace(/^Due in /i, '').replace(/^Due now.*$/i, 'now');

/** Home page (build 10 layout): tiles, start a service, shortcuts, then brief lists. */
export function HomePage({ onShowStatus }: { onShowStatus: () => void }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { activeFleet, fleetAssets, tasks, logs, assignments, thresholds, prefs, updateHours, shopping, jobs } = useStore();

  const now = new Date();
  const ids = new Set(fleetAssets.map((a) => a.id));
  const due = getDueList(fleetAssets, tasks, now, thresholds);
  const overdue = due.filter((d) => d.status === 'overdue');
  const needing = fleetAssets.filter((a) => machineStatus(a, tasks, now, thresholds).level !== 'green');
  const stale = getStaleAssets(fleetAssets, now, activeFleet.staleHoursDays);
  const recent = getRecentLogs(logs.filter((l) => ids.has(l.assetId)), now, 30).slice(0, 5);
  const open = assignments.filter((a) => a.status === 'open' && ids.has(a.assetId));
  const mine = open.filter((a) => a.technicianId === prefs.meTechnicianId || !a.technicianId);
  const others = open.filter((a) => !mine.includes(a));
  const assetName = (id: string) => fleetAssets.find((a) => a.id === id)?.name ?? 'Unknown';

  const openService = (assetId?: string) => router.push(assetId ? { pathname: '/service', params: { assetId } } : '/service');
  const openMachine = (id: string) => router.push({ pathname: '/machine/[id]', params: { id } });

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <UpdateBanner />
      <View style={s.tiles}>
        <Tile label="Need service" value={needing.length} color={needing.length ? c.danger : c.ok} onPress={onShowStatus} />
        <Tile label="Overdue items" value={overdue.length} color={c.orange} onPress={onShowStatus} />
        <Tile label="Hours stale" value={stale.length} color={c.warn} />
      </View>

      <Button title="🔧  Start a service" onPress={() => openService()} style={{ marginBottom: spacing.sm, minHeight: 60 }} />
      <View style={s.grid}>
        <Button title="Find / scan" variant="secondary" style={s.gridItem} onPress={() => router.push({ pathname: '/find', params: { next: 'service' } })} />
        <Button
          title={`Shopping (${shopping.filter((i) => !i.purchased && i.fleetId === activeFleet.id).length})`}
          variant="secondary"
          style={s.gridItem}
          onPress={() => router.push('/shopping')}
        />
        <Button title={`Invoices (${jobs.filter((j) => j.status === 'invoiced').length})`} variant="secondary" style={s.gridItem} onPress={() => router.push('/jobs')} />
        <Button title="Fleet status" variant="secondary" style={s.gridItem} onPress={onShowStatus} />
      </View>

      {mine.length + others.length > 0 && (
        <View style={s.section}>
          <SectionTitle>Assigned work</SectionTitle>
          {[...mine, ...others].map((a) => (
            <AssignmentCard key={a.id} assignment={a} showMachine compact onOpen={() => openMachine(a.assetId)} />
          ))}
        </View>
      )}

      <View style={s.section}>
        <SectionTitle
          right={
            due.length > DUE_SHOWN ? (
              <Pressable onPress={onShowStatus} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>All {due.length} ›</Text>
              </Pressable>
            ) : undefined
          }
        >
          Service due
        </SectionTitle>
        {due.length === 0 ? (
          <Muted>Nothing due. All equipment is up to date.</Muted>
        ) : (
          <View style={s.list}>
            {due.slice(0, DUE_SHOWN).map((d, i) => (
              <Pressable
                key={d.task.id}
                onPress={() => openService(d.asset.id)}
                accessibilityRole="button"
                accessibilityLabel={`${d.asset.name}, ${d.task.name}, ${d.detail}`}
                style={({ pressed }) => [s.dueRow, i > 0 && s.divider, pressed && { opacity: 0.6 }]}
              >
                <View style={[s.dot, { backgroundColor: levelColor(c, d.level) }]} />
                <Text style={s.dueMachine} numberOfLines={1}>
                  {d.asset.name}
                </Text>
                <Text style={s.dueTask} numberOfLines={1}>
                  {d.task.name}
                </Text>
                <Text style={[s.dueWhen, { color: levelColor(c, d.level) }]}>{brief(d)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {stale.length > 0 && (
        <View style={s.section}>
          <SectionTitle>Hours to update</SectionTitle>
          {stale.map((a) => (
            <HoursRow key={a.id} asset={a} now={now} onSave={updateHours} />
          ))}
        </View>
      )}

      <View style={s.section}>
        <SectionTitle>Recently done</SectionTitle>
        {recent.length === 0 ? (
          <Muted>No services logged in the last 30 days.</Muted>
        ) : (
          <View style={s.list}>
            {recent.map((l, i) => (
              <Pressable key={l.id} onPress={() => openMachine(l.assetId)} style={[s.dueRow, i > 0 && s.divider]} accessibilityRole="button">
                <View style={[s.dot, { backgroundColor: c.ok }]} />
                <Text style={s.dueMachine} numberOfLines={1}>
                  {assetName(l.assetId)}
                </Text>
                <Text style={s.dueTask} numberOfLines={1}>
                  {l.taskName}
                </Text>
                <Text style={s.doneWhen}>{new Date(l.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 5 },
    tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    gridItem: { flexBasis: '47%', flexGrow: 1 },
    section: { marginBottom: spacing.lg },
    link: { color: c.accent, fontSize: 14, fontFamily: font.medium },
    list: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius, paddingHorizontal: spacing.md },
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dueMachine: { color: c.text, fontSize: 16, fontFamily: font.heading, maxWidth: '34%' },
    dueTask: { color: c.muted, fontSize: 14, fontFamily: font.light, flex: 1 },
    dueWhen: { fontSize: 14, fontFamily: font.medium },
    doneWhen: { color: c.muted, fontSize: 13, fontFamily: font.regular },
  });
