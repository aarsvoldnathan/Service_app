import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScannerModal } from '../src/components/ScannerModal';
import { Button, levelColor, Muted } from '../src/components/ui';
import { findAssets, LEVEL_LABEL, machineStatus } from '../src/maintenance';
import { useStore } from '../src/store';
import { font, Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

/**
 * Quick hours: find or scan a machine, type its hours, done.
 * Shows only the machine, serial number and status color; maintenance due appears after the update.
 */
export default function QuickHours() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  const { assets, tasks, thresholds, fleets, updateHours, setPrefs, activeFleet } = useStore();
  const [scanning, setScanning] = useState(scan === '1');
  const [query, setQuery] = useState('');
  const [id, setId] = useState<string | undefined>();
  const [hours, setHours] = useState('');
  const [saved, setSaved] = useState(false);
  const input = useRef<TextInput>(null);

  const asset = assets.find((a) => a.id === id);
  const now = new Date();
  const status = asset ? machineStatus(asset, tasks, now, fleets.find((f) => f.id === asset.fleetId) ?? thresholds) : undefined;
  const color = status ? levelColor(c, status.level) : c.border;
  const results = query.trim() ? findAssets(assets, query).slice(0, 8) : [];

  useEffect(() => {
    if (asset && !saved) setTimeout(() => input.current?.focus(), 300);
  }, [asset?.id]);

  const choose = (aid: string) => {
    const a = assets.find((x) => x.id === aid);
    if (!a) return;
    if (a.fleetId !== activeFleet.id) setPrefs({ activeFleetId: a.fleetId });
    setId(aid);
    setHours('');
    setSaved(false);
    setQuery('');
  };

  const onScanned = (code: string) => {
    setScanning(false);
    const m = findAssets(assets, code).filter((a) => a.barcode?.toLowerCase() === code.toLowerCase() || a.serial.toLowerCase() === code.toLowerCase());
    if (m.length === 1) choose(m[0].id);
    else {
      setQuery(code);
      Alert.alert('No machine with this code', `Scanned: ${code}. Search below or add it in Settings › Machines.`);
    }
  };

  const save = () => {
    if (!asset) return;
    const n = Number(hours.replace(',', '.'));
    const err = updateHours(asset.id, n);
    if (err) return Alert.alert('Hours', err);
    setSaved(true);
  };

  const next = () => {
    setId(undefined);
    setSaved(false);
    setHours('');
    setScanning(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: 'Quick hours' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {!asset ? (
          <>
            <Button title="Scan machine" onPress={() => setScanning(true)} style={{ minHeight: 64 }} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="or search name / serial"
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.search}
            />
            {results.map((a) => {
              const lvl = machineStatus(a, tasks, now, thresholds).level;
              return (
                <Pressable key={a.id} onPress={() => choose(a.id)} style={[s.result, { borderLeftColor: levelColor(c, lvl) }]} accessibilityRole="button">
                  <Text style={s.resultName}>{a.name}</Text>
                  <Text style={s.resultSerial}>{a.serial || '—'}</Text>
                </Pressable>
              );
            })}
            {query.trim() && !results.length ? <Muted>No machine matches.</Muted> : null}
          </>
        ) : (
          <View style={[s.card, { borderColor: color }]}>
            <View style={[s.stripe, { backgroundColor: color }]} />
            <Text style={s.name}>{asset.name}</Text>
            <Text style={s.serial}>S/N {asset.serial || '—'}</Text>
            <Text style={[s.status, { color }]}>{status ? LEVEL_LABEL[status.level] : ''}</Text>

            {!saved ? (
              <>
                <Text style={s.label}>Hours now (last {asset.currentHours} h)</Text>
                <TextInput
                  ref={input}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="decimal-pad"
                  placeholder={String(asset.currentHours)}
                  placeholderTextColor={c.border}
                  style={s.hours}
                  returnKeyType="done"
                  onSubmitEditing={save}
                  accessibilityLabel="Hours now"
                />
                <Button title="Update hours" onPress={save} disabled={!hours.trim()} style={{ alignSelf: 'stretch', minHeight: 60 }} />
              </>
            ) : (
              <>
                <Text style={s.savedHours}>{asset.currentHours} h ✓</Text>
                {status && status.needs.length ? (
                  <View style={[s.due, { borderColor: color }]}>
                    <Text style={[s.dueTitle, { color }]}>Maintenance due</Text>
                    {status.needs.slice(0, 3).map((d) => (
                      <Text key={d.task.id} style={s.dueItem}>
                        {d.task.name} · <Text style={{ color: levelColor(c, d.level) }}>{d.detail.toLowerCase()}</Text>
                      </Text>
                    ))}
                    {status.needs.length > 3 ? <Text style={s.dueItem}>+ {status.needs.length - 3} more</Text> : null}
                  </View>
                ) : (
                  <Text style={[s.ok, { color: c.ok }]}>No maintenance due</Text>
                )}
                <Button title="Scan next machine" onPress={next} style={{ alignSelf: 'stretch', minHeight: 60, marginTop: spacing.md }} />
              </>
            )}
            <Pressable onPress={() => setId(undefined)} hitSlop={8} style={{ marginTop: spacing.md }}>
              <Text style={s.change}>Different machine</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <ScannerModal visible={scanning} onScanned={onScanned} onClose={() => setScanning(false)} />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    search: { marginTop: spacing.md, minHeight: 52, borderWidth: 1, borderColor: c.border, borderRadius: radius, paddingHorizontal: spacing.md, color: c.text, fontSize: 17, fontFamily: font.regular, backgroundColor: c.card },
    result: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderLeftWidth: 8 },
    resultName: { color: c.text, fontSize: 19, fontFamily: font.heading },
    resultSerial: { color: c.muted, fontSize: 14, fontFamily: font.light },
    card: { alignItems: 'center', borderWidth: 3, borderRadius: 20, padding: spacing.lg, paddingTop: spacing.lg + 8, backgroundColor: c.card, overflow: 'hidden' },
    stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 10 },
    name: { color: c.text, fontSize: 32, fontFamily: font.headingBold, textAlign: 'center', textTransform: 'uppercase' },
    serial: { color: c.muted, fontSize: 16, fontFamily: font.light, marginTop: 2 },
    status: { fontSize: 16, fontFamily: font.heading, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontFamily: font.regular, marginTop: spacing.lg },
    hours: { color: c.text, fontSize: 52, fontFamily: font.headingBold, textAlign: 'center', minWidth: 200, marginVertical: spacing.sm },
    savedHours: { color: c.text, fontSize: 44, fontFamily: font.headingBold, marginTop: spacing.lg },
    due: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radius, padding: spacing.md, marginTop: spacing.md },
    dueTitle: { fontSize: 16, fontFamily: font.heading, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    dueItem: { color: c.text, fontSize: 15, fontFamily: font.light, marginTop: 2 },
    ok: { fontSize: 18, fontFamily: font.heading, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.md },
    change: { color: c.muted, fontSize: 14, fontFamily: font.regular, textDecorationLine: 'underline' },
  });
