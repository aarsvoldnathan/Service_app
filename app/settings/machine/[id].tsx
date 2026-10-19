import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScannerModal } from '../../../src/components/ScannerModal';
import { ScheduleEditor } from '../../../src/components/ScheduleEditor';
import { Button, Card, ChipSelect, Field, SectionTitle } from '../../../src/components/ui';
import { useStore } from '../../../src/store';
import { Palette, spacing, useStyles } from '../../../src/theme';

type ScanTarget = 'barcode' | 'serial' | null;

/** Create or edit a machine profile, its codes and its maintenance schedule. */
export default function MachineEditScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; barcode?: string; fleetId?: string }>();
  const { assets, fleets, activeFleet, saveAsset, deleteAsset } = useStore();
  // After adding a new machine we stay on this screen and switch to editing it.
  const [createdId, setCreatedId] = useState<string | undefined>();
  const existing = assets.find((a) => a.id === (createdId ?? params.id));
  const isNew = !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [make, setMake] = useState(existing?.make ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [year, setYear] = useState(existing?.year ?? '');
  const [serial, setSerial] = useState(existing?.serial ?? '');
  const [barcode, setBarcode] = useState(existing?.barcode ?? params.barcode ?? '');
  const [fleetId, setFleetId] = useState(existing?.fleetId ?? params.fleetId ?? activeFleet.id);
  const [hours, setHours] = useState(String(existing?.currentHours ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [scan, setScan] = useState<ScanTarget>(null);

  const save = () => {
    const h = Number(hours.replace(',', '.'));
    if (!Number.isFinite(h) || h < 0) {
      Alert.alert('Check the hours', 'Enter the current hour meter reading.');
      return;
    }
    const hoursChanged = !existing || existing.currentHours !== h;
    const { error, id } = saveAsset({
      id: existing?.id,
      fleetId,
      name,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: year.trim() || undefined,
      serial,
      barcode,
      currentHours: h,
      hoursUpdatedAt: hoursChanged ? new Date().toISOString() : existing!.hoursUpdatedAt,
      specs: existing?.specs ?? { filters: [] },
      notes: notes.trim() || undefined,
    });
    if (error) {
      Alert.alert('Cannot save machine', error);
      return;
    }
    if (isNew && id) {
      // Stay here so the new machine's schedule can be set up right away.
      setCreatedId(id);
      Alert.alert('Machine added', 'Clean filters, check fluids and grease were added at every 10 hours. Add the factory schedule below.');
    } else {
      router.back();
    }
  };

  const remove = () =>
    Alert.alert(`Delete ${existing?.name}?`, 'Its schedule, service history and assignments are deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteAsset(existing!.id);
          router.back();
        },
      },
    ]);

  const fleet = fleets.find((f) => f.id === fleetId);
  const thresholds = fleet
    ? { orangeOverdueHours: fleet.orangeOverdueHours, majorWarnHours: fleet.majorWarnHours }
    : { orangeOverdueHours: 10, majorWarnHours: 10 };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: isNew ? 'New machine' : 'Edit machine' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Machine name" placeholder="e.g. Kubota L3901 #2" value={name} onChangeText={setName} />
          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field label="Make" value={make} onChangeText={setMake} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Model" value={model} onChangeText={setModel} />
            </View>
          </View>
          <Field label="Year" keyboardType="number-pad" value={year} onChangeText={setYear} />
          <Field label="Current hours" keyboardType="decimal-pad" value={hours} onChangeText={setHours} hint="You can correct a wrong reading here." />
          <Text style={s.label}>Fleet</Text>
          <ChipSelect options={fleets.map((f) => ({ value: f.id, label: f.name }))} value={fleetId} onChange={setFleetId} />
        </Card>

        <View style={s.section}>
          <SectionTitle>Identification</SectionTitle>
          <Card>
            <Field label="Serial number" autoCapitalize="characters" autoCorrect={false} value={serial} onChangeText={setSerial} />
            <Button title="Scan serial number barcode" variant="secondary" onPress={() => setScan('serial')} style={{ marginTop: -spacing.sm, marginBottom: spacing.md }} />
            <Field
              label="Barcode / QR code"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Scan the sticker on the machine"
              value={barcode}
              onChangeText={setBarcode}
              hint="Put a barcode or QR sticker on the machine, then scan it here to link it."
            />
            <Button title="Scan barcode / QR sticker" variant="secondary" onPress={() => setScan('barcode')} style={{ marginTop: -spacing.sm }} />
          </Card>
        </View>

        <Field label="Notes" placeholder="Location, attachments, fluid details" value={notes} onChangeText={setNotes} multiline />

        <Button title={isNew ? 'Add machine' : 'Save machine'} onPress={save} />

        {!isNew && (
          <View style={s.section}>
            <SectionTitle>Maintenance schedule</SectionTitle>
            <Card>
              <ScheduleEditor asset={existing!} thresholds={thresholds} />
            </Card>
            <Button title="Delete machine" variant="danger" onPress={remove} style={{ marginTop: spacing.lg }} />
          </View>
        )}
      </ScrollView>
      <ScannerModal
        visible={scan !== null}
        title={scan === 'serial' ? 'Scan serial number' : 'Scan machine sticker'}
        onClose={() => setScan(null)}
        onScanned={(code) => {
          if (scan === 'serial') setSerial(code);
          else setBarcode(code);
          setScan(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    section: { marginTop: spacing.lg, marginBottom: spacing.md },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    two: { flexDirection: 'row', gap: spacing.sm },
  });
