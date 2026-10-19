import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScannerModal } from '../../../src/components/ScannerModal';
import { ScheduleEditor } from '../../../src/components/ScheduleEditor';
import { Button, Card, ChipSelect, Field, SectionTitle } from '../../../src/components/ui';
import { useStore } from '../../../src/store';
import { findTemplate, TEMPLATES, templateLabel } from '../../../src/templates';
import { Palette, spacing, useStyles } from '../../../src/theme';

type ScanTarget = 'barcode' | 'serial' | null;

/** Create or edit a machine profile, its codes and its maintenance schedule. */
export default function MachineEditScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; barcode?: string; fleetId?: string }>();
  const { assets, fleets, categories, activeFleet, saveAsset, deleteAsset, applyTemplate } = useStore();
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
  const [templateId, setTemplateId] = useState<string | undefined>(existing?.templateId);
  const [category, setCategory] = useState<string | undefined>(existing?.category);
  const template = findTemplate(templateId);
  const categoryTemplates = TEMPLATES.filter((t) => t.category === category);

  const pickCategory = (id: string) => {
    setCategory(id);
    // A model from another category no longer fits.
    if (findTemplate(templateId)?.category !== id) setTemplateId(undefined);
  };

  const pickTemplate = (id: string) => {
    const t = findTemplate(id);
    setTemplateId(id);
    if (!t) return;
    setCategory(t.category);
    if (!make.trim()) setMake(t.make);
    if (!model.trim()) setModel(t.model);
    if (!name.trim()) setName(templateLabel(t));
  };

  const loadTemplate = () => {
    if (!existing || !template) return;
    Alert.alert(
      `Load ${templateLabel(template)} schedule?`,
      'This replaces the service items on this machine with the factory schedule, counting from the current hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace schedule', style: 'destructive', onPress: () => applyTemplate(existing.id, template.id) },
      ],
    );
  };

  const save = () => {
    if (!category) {
      Alert.alert('Choose the type of equipment', 'Pick skid steer, excavator, trailer and so on at the top.');
      return;
    }
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
      templateId: existing ? existing.templateId : templateId,
      category,
      serial,
      barcode,
      currentHours: h,
      hoursUpdatedAt: hoursChanged ? new Date().toISOString() : existing!.hoursUpdatedAt,
      specs: existing?.specs ?? { values: {}, filters: [] },
      notes: notes.trim() || undefined,
    });
    if (error) {
      Alert.alert('Cannot save machine', error);
      return;
    }
    if (isNew && id) {
      // Stay here so the new machine's schedule can be set up right away.
      setCreatedId(id);
      Alert.alert(
        'Machine added',
        template
          ? `The ${templateLabel(template)} factory schedule was added. Review it below.`
          : 'Starter service items for this type of equipment were added. Add the rest of the schedule below.',
      );
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
        <SectionTitle>What kind of equipment?</SectionTitle>
        <Card style={{ marginBottom: spacing.lg }}>
          <ChipSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} value={category} onChange={pickCategory} />
          <Text style={s.help}>Sets which service specs are shown. Edit categories in Settings › Equipment categories.</Text>
        </Card>

        {category && (
        <>
        <SectionTitle>Model (factory schedule)</SectionTitle>
        <Card style={{ marginBottom: spacing.lg }}>
          {categoryTemplates.length > 0 ? (
            <ChipSelect
              options={categoryTemplates.map((t) => ({ value: t.id, label: templateLabel(t) }))}
              value={templateId}
              onChange={pickTemplate}
            />
          ) : (
            <Text style={s.help}>No factory schedules saved for this type yet.</Text>
          )}
          {template ? (
            <Text style={s.help}>
              {template.type} · {template.items.length} service items.{' '}
              {template.verified
                ? 'From the manufacturer’s published service chart. Check the decal on your machine for your serial number.'
                : 'Some intervals could not be confirmed from the manufacturer’s chart — check the decal on your machine.'}
            </Text>
          ) : (
            <Text style={s.help}>Pick a model to load its factory service schedule, or leave blank for the starter items.</Text>
          )}
          {!isNew && template && (
            <Button title={`Load ${templateLabel(template)} schedule`} variant="secondary" onPress={loadTemplate} style={{ marginTop: spacing.sm }} />
          )}
        </Card>
        </>
        )}

        <Card>
          <Field label="Machine name" placeholder="e.g. Bobcat T66 #1" value={name} onChangeText={setName} />
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
    help: { color: c.muted, fontSize: 13, marginTop: spacing.sm },
  });
