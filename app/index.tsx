import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCloud } from '../src/cloud';
import { BottomBar, FeedCard, initials, StoriesRow, timeAgo, useNow } from '../src/components/Social';
import { UpdateBanner } from '../src/components/UpdateBanner';
import { Button, ListRow } from '../src/components/ui';
import { clockText, runningHours } from '../src/finance';
import { getRecentLogs, getStaleAssets, LEVEL_LABEL, LEVEL_RANK, machineStatus } from '../src/maintenance';
import { useStore } from '../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

/** Home: machines as stories on top, then one feed of what needs doing and what was done. */
export default function Home() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { ready, fleets, activeFleet, fleetAssets, tasks, logs, assignments, thresholds, prefs, setPrefs, technicianName, shopping, jobs } = useStore();
  const { isOwner } = useCloud();
  const [fleetMenu, setFleetMenu] = useState(false);
  const now = useNow(1000);

  if (!ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  const ids = new Set(fleetAssets.map((a) => a.id));
  const statuses = fleetAssets
    .map((a) => machineStatus(a, tasks, now, thresholds))
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.asset.name.localeCompare(b.asset.name));
  const needing = statuses.filter((st) => st.level !== 'green');
  const stale = getStaleAssets(fleetAssets, now, activeFleet.staleHoursDays);
  const recent = getRecentLogs(logs.filter((l) => ids.has(l.assetId)), now, 30).slice(0, 15);
  const open = assignments
    .filter((a) => a.status === 'open' && ids.has(a.assetId))
    .sort((a, b) => Number(b.technicianId === prefs.meTechnicianId) - Number(a.technicianId === prefs.meTechnicianId));
  const clocks = jobs.filter((j) => j.clockStartedAt && (isOwner || j.technicianId === prefs.meTechnicianId));
  const toBuy = shopping.filter((i) => !i.purchased && i.fleetId === activeFleet.id).length;
  const assetName = (id: string) => fleetAssets.find((a) => a.id === id)?.name ?? 'Machine';

  const openService = (assetId: string) => router.push({ pathname: '/service', params: { assetId } });
  const openMachine = (id: string) => router.push({ pathname: '/machine/[id]', params: { id } });
  const allClear = !needing.length && !open.length && !stale.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          headerTitle: '',
          headerLeft: () => (
            <Pressable onPress={() => setFleetMenu(true)} accessibilityRole="button" accessibilityLabel={`Fleet ${activeFleet.name}. Change fleet`} hitSlop={8} style={s.fleetButton}>
              <Text style={s.fleetName} numberOfLines={1}>
                {activeFleet.name}
              </Text>
              <Text style={s.fleetCaret}>⌄</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => router.push('/shopping')} accessibilityRole="button" accessibilityLabel={`Shopping list, ${toBuy} to buy`} hitSlop={8} style={s.cart}>
              <Text style={s.cartIcon}>🛒</Text>
              {toBuy ? (
                <View style={s.cartBadge}>
                  <Text style={s.cartBadgeText}>{toBuy}</Text>
                </View>
              ) : null}
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <UpdateBanner />
        </View>

        <StoriesRow
          stories={statuses.map((st) => ({ id: st.asset.id, name: st.asset.name, level: st.level, onPress: () => openMachine(st.asset.id) }))}
          onAdd={() => router.push({ pathname: '/settings/machine/[id]', params: { id: 'new' } })}
        />

        {/* Running time clocks */}
        {clocks.map((j) => (
          <Pressable key={j.id} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: j.id } })} style={s.clock} accessibilityRole="button">
            <View style={s.liveDot} />
            <Text style={s.clockLabel} numberOfLines={1}>
              On the clock · {j.title}
            </Text>
            <Text style={s.clockTime}>{clockText(runningHours(j, now))}</Text>
          </Pressable>
        ))}

        {/* One-line summary */}
        <Pressable onPress={() => router.push('/status')} style={s.summary} accessibilityRole="button">
          <Text style={s.summaryText}>
            {fleetAssets.length === 0
              ? 'Add your first machine to get started'
              : allClear
                ? `All ${fleetAssets.length} machines are up to date ✓`
                : [needing.length && `${needing.length} need service`, open.length && `${open.length} assigned`, stale.length && `${stale.length} need hours`]
                    .filter(Boolean)
                    .join(' · ')}
          </Text>
          {fleetAssets.length ? <Text style={s.summaryLink}>Status ›</Text> : null}
        </Pressable>

        {/* Feed: what needs doing */}
        {open.map((a) => (
          <FeedCard
            key={a.id}
            avatar={initials(assetName(a.assetId))}
            title={assetName(a.assetId)}
            meta={`Assigned to ${a.technicianId ? technicianName(a.technicianId) : 'anyone'} · ${timeAgo(a.createdAt, now)}`}
            body={a.notes?.trim() || `${a.items.filter((i) => !i.done).length} of ${a.items.length} items to do`}
            detail={a.items.filter((i) => !i.done).slice(0, 3).map((i) => `○ ${i.text}`).join('\n') || undefined}
            onPress={() => openMachine(a.assetId)}
            actions={[{ label: 'Start work', primary: true, onPress: () => openService(a.assetId) }]}
          />
        ))}
        {needing.map((st) => {
          const top = st.needs[0];
          return (
            <FeedCard
              key={st.asset.id}
              avatar={initials(st.asset.name)}
              level={st.level}
              title={st.asset.name}
              meta={`${LEVEL_LABEL[st.level]} · ${st.asset.currentHours} h`}
              body={`${top.task.name} — ${top.detail.toLowerCase()}`}
              detail={st.needs.length > 1 ? `+ ${st.needs.slice(1, 4).map((n) => n.task.name).join(', ')}${st.needs.length > 4 ? '…' : ''}` : undefined}
              onPress={() => openMachine(st.asset.id)}
              actions={[{ label: 'Log service', primary: true, onPress: () => openService(st.asset.id) }]}
            />
          );
        })}
        {stale.length ? (
          <FeedCard
            avatar="⏱"
            title="Hours check"
            meta={`Not updated in ${activeFleet.staleHoursDays}+ days`}
            body={`Update hours on ${stale.length === 1 ? stale[0].name : `${stale.length} machines`}`}
            detail={stale.length > 1 ? stale.slice(0, 6).map((a) => a.name).join(', ') : undefined}
            actions={stale.slice(0, 3).map((a) => ({ label: a.name, onPress: () => openService(a.id) }))}
          />
        ) : null}

        {/* Feed: what was done */}
        {recent.map((l) => (
          <FeedCard
            key={l.id}
            avatar={initials(assetName(l.assetId))}
            level="green"
            title={assetName(l.assetId)}
            meta={`${l.performedBy} · ${timeAgo(l.date, now)} · ${l.hoursAtService} h`}
            body={`✓ ${l.taskName}`}
            detail={[l.description, l.parts?.length ? l.parts.map((p) => [p.name, p.partNumber].filter(Boolean).join(' ')).join(', ') : ''].filter(Boolean).join('\n') || undefined}
            onPress={() => openMachine(l.assetId)}
          />
        ))}
        {!recent.length && fleetAssets.length ? <Text style={s.end}>Services you log show up here.</Text> : null}
      </ScrollView>

      <BottomBar active="home" timeBadge={clocks.length > 0} />

      {/* Fleet switcher */}
      <Modal visible={fleetMenu} transparent animationType="fade" onRequestClose={() => setFleetMenu(false)}>
        <Pressable style={s.backdrop} onPress={() => setFleetMenu(false)} accessibilityLabel="Close fleet menu">
          <Pressable style={s.menu} onPress={() => {}}>
            <Text style={s.menuTitle}>Switch fleet</Text>
            {fleets.map((f) => (
              <ListRow
                key={f.id}
                title={`${f.name}${f.id === activeFleet.id ? '  ✓' : ''}`}
                subtitle={f.kind === 'work' ? 'Work' : 'Home'}
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
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    fleetButton: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 260, paddingLeft: spacing.xs },
    fleetName: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    fleetCaret: { color: c.text, fontSize: 18, fontWeight: '800', marginTop: -6 },
    cart: { paddingHorizontal: spacing.sm },
    cartIcon: { fontSize: 24 },
    cartBadge: { position: 'absolute', top: -4, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    clock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.danger,
    },
    liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger },
    clockLabel: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
    clockTime: { color: c.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
    summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
    summaryText: { color: c.muted, fontSize: 14, fontWeight: '600', flex: 1 },
    summaryLink: { color: c.accent, fontSize: 14, fontWeight: '700' },
    end: { color: c.muted, fontSize: 13, textAlign: 'center', padding: spacing.lg },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 100, paddingHorizontal: spacing.md },
    menu: { backgroundColor: c.bg, borderRadius: radius, padding: spacing.md, borderWidth: 1, borderColor: c.border },
    menuTitle: { color: c.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  });
