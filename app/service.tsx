import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignmentCard } from '../src/components/AssignmentCard';
import { HoursRow } from '../src/components/HoursRow';
import { ManualLinks } from '../src/components/ManualLinks';
import { ScheduleEditor } from '../src/components/ScheduleEditor';
import { ServiceForm } from '../src/components/ServiceForm';
import { SpecsCard } from '../src/components/SpecsCard';
import { Button, Card, HeaderButton, levelColor, Muted, SectionTitle } from '../src/components/ui';
import { LEVEL_LABEL, machineStatus } from '../src/maintenance';
import { useStore } from '../src/store';
import { Palette, radius, spacing, touch, useStyles, useTheme } from '../src/theme';

export default function ServiceScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string }>();
  const store = useStore();
  const {
    fleetAssets, tasks, logs, assignments, technicians, activeFleet, thresholds, prefs,
    currentAssetId, setCurrentAssetId, addServiceLog, updateSpecs, updateHours, categoryOf, shopping,
  } = store;
  const [showIntervals, setShowIntervals] = useState(false);

  // A machine passed in the link (dashboard, status page) wins over the last one used.
  useEffect(() => {
    if (params.assetId) setCurrentAssetId(params.assetId);
  }, [params.assetId, setCurrentAssetId]);

  const asset = fleetAssets.find((a) => a.id === currentAssetId) ?? fleetAssets[0];
  const assetTasks = asset ? tasks.filter((t) => t.assetId === asset.id) : [];
  const status = asset ? machineStatus(asset, tasks, new Date(), thresholds) : undefined;
  const openWork = asset ? assignments.filter((a) => a.assetId === asset.id && a.status === 'open') : [];
  const fleetTechs = technicians.filter((t) => activeFleet.memberIds.includes(t.id));
  const history = asset
    ? logs.filter((l) => l.assetId === asset.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Record service',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {asset ? (
                <HeaderButton
                  title="✨ Ask AI"
                  label="Ask the AI helper about this machine"
                  onPress={() => router.push({ pathname: '/assistant', params: { assetId: asset.id } })}
                />
              ) : null}
              <HeaderButton title="Find ⌕" label="Find machine by scan, serial or search" onPress={() => router.push('/find')} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Machine picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.picker}>
          {fleetAssets.map((a) => {
            const active = a.id === asset?.id;
            const lvl = machineStatus(a, tasks, new Date(), thresholds).level;
            return (
              <Pressable
                key={a.id}
                onPress={() => setCurrentAssetId(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[s.chip, active && s.chipActive]}
              >
                <View style={[s.chipDot, { backgroundColor: levelColor(c, lvl) }]} />
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!asset ? (
          <View>
            <Muted>No machines in {activeFleet.name} yet.</Muted>
            <Button title="Add a machine" onPress={() => router.push({ pathname: '/settings/machine/[id]', params: { id: 'new' } })} />
          </View>
        ) : (
          <>
            {/* Machine header */}
            <View style={s.header}>
              <Text style={s.name}>{asset.name}</Text>
              <Text style={s.sub} selectable>
                Serial: {asset.serial || '—'}
                {asset.barcode ? `  ·  Code: ${asset.barcode}` : ''}
              </Text>
              {status ? (
                <View style={s.statusRow}>
                  <View style={[s.statusDot, { backgroundColor: levelColor(c, status.level) }]} />
                  <Text style={[s.statusText, { color: levelColor(c, status.level) }]}>{LEVEL_LABEL[status.level]}</Text>
                </View>
              ) : null}
            </View>

            {/* Hours, first so it is quick to update */}
            <View style={s.section}>
              <SectionTitle>Current hours</SectionTitle>
              <HoursRow key={asset.id} asset={asset} now={new Date()} onSave={updateHours} showName={false} />
            </View>

            {openWork.length > 0 && (
              <View style={s.section}>
                <SectionTitle>Assigned work</SectionTitle>
                {openWork.map((a) => (
                  <AssignmentCard key={a.id} assignment={a} />
                ))}
              </View>
            )}

            <View style={s.section}>
              <SectionTitle
                right={
                  <Pressable onPress={() => router.push({ pathname: '/shopping', params: { assetId: asset.id } })} accessibilityRole="button" hitSlop={8}>
                    <Text style={s.link}>Shopping list ({shopping.filter((x) => !x.purchased && x.fleetId === activeFleet.id).length}) ›</Text>
                  </Pressable>
                }
              >
                Service specs
              </SectionTitle>
              <SpecsCard key={asset.id} asset={asset} category={categoryOf(asset)} onSave={(specs) => updateSpecs(asset.id, specs)} />
              <Card style={{ marginTop: spacing.sm }}>
                <Pressable
                  onPress={() => setShowIntervals((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showIntervals }}
                  style={s.intervalHead}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.intervalTitle}>Service intervals</Text>
                    <Text style={s.intervalSub}>{assetTasks.length} items · tap to {showIntervals ? 'hide' : 'view and edit'}</Text>
                  </View>
                  <Text style={s.intervalToggle}>{showIntervals ? '▲' : '▼'}</Text>
                </Pressable>
                {showIntervals && <ScheduleEditor asset={asset} thresholds={thresholds} />}
              </Card>
              <ManualLinks asset={asset} />
            </View>

            <View style={s.section}>
              <SectionTitle>Log a service</SectionTitle>
              <ServiceForm
                key={asset.id}
                asset={asset}
                tasks={assetTasks}
                thresholds={thresholds}
                technicians={fleetTechs}
                defaultTechnicianId={prefs.meTechnicianId}
                onSubmit={addServiceLog}
              />
            </View>

            <View style={s.section}>
              <SectionTitle>Service history</SectionTitle>
              {history.length === 0 ? (
                <Muted>No services logged for this machine yet.</Muted>
              ) : (
                history.map((l) => (
                  <Card key={l.id} style={s.logCard}>
                    <Text style={s.logTitle}>{l.taskName}</Text>
                    <Text style={s.logMeta}>
                      {new Date(l.date).toLocaleDateString()} · {l.hoursAtService} h · {l.performedBy}
                    </Text>
                    {l.description ? <Text style={s.logBody}>{l.description}</Text> : null}
                    {l.parts && l.parts.length > 0 ? (
                      <View style={{ marginTop: spacing.sm }}>
                        {l.parts.map((p, i) => (
                          <Text key={i} style={s.logPart}>
                            {p.quantity ? `${p.quantity} × ` : ''}
                            {p.name}
                            {p.partNumber ? `  ${p.partNumber}` : ''}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {l.notes ? <Text style={s.logNotes}>{l.notes}</Text> : null}
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    picker: { gap: spacing.sm, paddingBottom: spacing.md },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: touch - 8,
      maxWidth: 260,
      paddingHorizontal: spacing.md,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    chipActive: { borderColor: c.accent, borderWidth: 2 },
    chipDot: { width: 10, height: 10, borderRadius: 5 },
    chipText: { color: c.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    chipTextActive: { color: c.accent },
    header: { marginBottom: spacing.lg },
    name: { color: c.text, fontSize: 26, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 15, marginTop: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    statusDot: { width: 12, height: 12, borderRadius: 6 },
    statusText: { fontSize: 15, fontWeight: '800' },
    section: { marginBottom: spacing.lg },
    link: { color: c.accent, fontSize: 14, fontWeight: '700' },
    intervalHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    intervalTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
    intervalSub: { color: c.muted, fontSize: 14, marginTop: 2 },
    intervalToggle: { color: c.accent, fontSize: 18, fontWeight: '800', paddingLeft: spacing.md },
    logCard: { marginBottom: spacing.sm, borderLeftWidth: 5, borderLeftColor: c.ok },
    logTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    logMeta: { color: c.muted, fontSize: 14, marginTop: 2 },
    logBody: { color: c.text, fontSize: 15, marginTop: spacing.sm },
    logPart: { color: c.accent, fontSize: 14, marginTop: 2 },
    logNotes: { color: c.muted, fontSize: 14, marginTop: spacing.sm, fontStyle: 'italic' },
  });
