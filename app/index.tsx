import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ListRow } from '../src/components/ui';
import { HomePage } from '../src/screens/HomePage';
import { HoursPage } from '../src/screens/HoursPage';
import { useStore } from '../src/store';
import { font, Palette, radius, spacing, useStyles, useTheme } from '../src/theme';
import SettingsScreen from './settings/index';
import StatusScreen from './status';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const PAGES: { key: string; label: string; icon: IconName; title?: string }[] = [
  { key: 'home', label: 'Home', icon: 'home-variant' },
  { key: 'status', label: 'Status', icon: 'traffic-light', title: 'Fleet status' },
  { key: 'hours', label: 'Hours', icon: 'clock-outline', title: 'Hours' },
  { key: 'settings', label: 'Settings', icon: 'cog', title: 'Settings' },
];

/** Main screen: swipe left/right between Home, Status, Hours and Settings, or tap the bar. */
export default function Main() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, fleets, activeFleet, setPrefs } = useStore();
  const pager = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const [fleetMenu, setFleetMenu] = useState(false);

  if (!ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  const go = (i: number) => {
    setPage(i);
    pager.current?.setPage(i);
  };
  const current = PAGES[page];

  const tab = (i: number) => {
    const p = PAGES[i];
    const on = page === i;
    return (
      <Pressable key={p.key} onPress={() => go(i)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.label}>
        <MaterialCommunityIcons name={p.icon} size={30} color={on ? c.accent : c.muted} />
        <Text style={[s.tabLabel, { color: on ? c.accent : c.muted }]}>{p.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={
          page === 0
            ? {
                headerTitle: () => (
                  <Pressable onPress={() => setFleetMenu(true)} accessibilityRole="button" accessibilityLabel={`Fleet: ${activeFleet.name}. Change fleet`} hitSlop={8} style={s.fleetButton}>
                    <Text style={s.fleetName} numberOfLines={1}>
                      {activeFleet.name}
                    </Text>
                    <Text style={s.fleetCaret}>▾</Text>
                  </Pressable>
                ),
              }
            : { headerTitle: current.title }
        }
      />

      <PagerView ref={pager} style={{ flex: 1 }} initialPage={0} onPageSelected={(e) => setPage(e.nativeEvent.position)}>
        <View key="home" style={{ flex: 1 }}>
          <HomePage onShowStatus={() => go(1)} />
        </View>
        <View key="status" style={{ flex: 1 }}>
          <StatusScreen embedded />
        </View>
        <View key="hours" style={{ flex: 1 }}>
          <HoursPage />
        </View>
        <View key="settings" style={{ flex: 1 }}>
          <SettingsScreen embedded />
        </View>
      </PagerView>

      {/* Bottom bar: two tabs, the wrench (start a service), two tabs */}
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {tab(0)}
        {tab(1)}
        <View style={s.wrenchSlot}>
          <Pressable onPress={() => router.push('/service')} style={({ pressed }) => [s.wrench, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel="Start a service">
            <MaterialCommunityIcons name="wrench" size={34} color={c.onAccent} />
          </Pressable>
        </View>
        {tab(2)}
        {tab(3)}
      </View>

      {/* Fleet drop-down */}
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
    fleetButton: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 240 },
    fleetName: { color: c.text, fontSize: 22, fontFamily: font.heading, letterSpacing: 0.5, textTransform: 'uppercase' },
    fleetCaret: { color: c.accent, fontSize: 16 },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: c.card,
      borderTopWidth: 3,
      borderTopColor: c.accent,
      paddingTop: 8,
      minHeight: 78,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58 },
    tabLabel: { fontSize: 13, fontFamily: font.heading, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
    wrenchSlot: { flex: 1.1, alignItems: 'center' },
    wrench: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -34,
      borderWidth: 5,
      borderColor: c.bg,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 8,
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 100, paddingHorizontal: spacing.md },
    menu: { backgroundColor: c.bg, borderRadius: radius, padding: spacing.md, borderWidth: 1, borderColor: c.border },
    menuTitle: { color: c.muted, fontSize: 14, fontFamily: font.heading, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  });
