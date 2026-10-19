import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, ListRow, SectionTitle } from '../../src/components/ui';
import { ANDROID_DOWNLOAD } from '../../src/config';
import { useStore } from '../../src/store';
import { Palette, spacing, useStyles } from '../../src/theme';

/** Invite people to the crew and pass a fleet between phones. */
export default function CrewScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { fleets, activeFleet, technicians, prefs, technicianName, exportFleet, importFleet } = useStore();
  const [fleetId, setFleetId] = useState(activeFleet.id);
  const fleet = fleets.find((f) => f.id === fleetId) ?? activeFleet;
  const me = prefs.meTechnicianId ? technicianName(prefs.meTechnicianId) : 'I';
  const members = technicians.filter((t) => fleet.memberIds.includes(t.id));

  const invite = () =>
    Share.share({
      message: [
        `${me === 'I' ? 'I am' : `${me} is`} inviting you to the "${fleet.name}" crew on Service Ceo, the app we use to track equipment service.`,
        '',
        `Android: open ${ANDROID_DOWNLOAD} on your phone, tap the .apk file and install it.`,
        'iPhone: reply with your Apple ID email and you will get a TestFlight invite.',
        '',
        `Then I will send you the "${fleet.name}" fleet file. Open it in Service Ceo (Settings › Crew & sharing › Import fleet).`,
      ].join('\n'),
    });

  const sendFleet = async () => {
    try {
      const bundle = exportFleet(fleet.id);
      const safe = fleet.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'fleet';
      const uri = `${FileSystem.cacheDirectory ?? ''}ServiceCeo-${safe}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(bundle));
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: `Send ${fleet.name}` });
    } catch (e) {
      Alert.alert('Could not create the fleet file', String(e));
    }
  };

  const receiveFleet = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert('Not a fleet file', 'Pick the ServiceCeo-….json file you were sent.');
        return;
      }
      const { error, summary } = importFleet(parsed);
      if (error) Alert.alert('Could not import', error);
      else {
        Alert.alert('Fleet imported', `${summary}\n\nSet who you are in Settings › Preferences.`);
        router.back();
      }
    } catch (e) {
      Alert.alert('Could not open the file', String(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Crew & sharing' }} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.label}>Fleet</Text>
        <ChipSelect options={fleets.map((f) => ({ value: f.id, label: f.name }))} value={fleetId} onChange={setFleetId} />

        <View style={s.section}>
          <SectionTitle>1. Invite someone</SectionTitle>
          <Card>
            <Text style={s.body}>
              Sends a text or email with the download link for the app. Add them as a technician and fleet member so their name shows up
              for service and assignments.
            </Text>
            <Button title="Send invite" onPress={invite} />
            <Button
              title="+ Add them as a technician"
              variant="secondary"
              onPress={() => router.push({ pathname: '/settings/technician/[id]', params: { id: 'new' } })}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </View>

        <View style={s.section}>
          <SectionTitle>2. Send the fleet</SectionTitle>
          <Card>
            <Text style={s.body}>
              Sends “{fleet.name}” as a file: its machines, schedules, service history, assignments, shopping list and crew names (never hourly rates, jobs or invoices). They open it with
              Import below. Send it again whenever you want them to have your latest updates.
            </Text>
            <Button title={`Send ${fleet.name}`} onPress={sendFleet} />
          </Card>
        </View>

        <View style={s.section}>
          <SectionTitle>3. Received a fleet?</SectionTitle>
          <Card>
            <Text style={s.body}>Pick the ServiceCeo-….json file you were sent. Matching machines and records are updated; nothing else is removed.</Text>
            <Button title="Import fleet file" variant="secondary" onPress={receiveFleet} />
          </Card>
        </View>

        <View style={s.section}>
          <SectionTitle>{`${fleet.name} crew (${members.length})`}</SectionTitle>
          {members.map((t) => (
            <ListRow
              key={t.id}
              title={t.name}
              subtitle={[t.role, t.phone, t.email].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/settings/technician/[id]', params: { id: t.id } })}
            />
          ))}
        </View>

        <Text style={s.note}>
          Today each phone keeps its own copy, and fleet files move updates between phones. Live sharing, where everyone sees changes
          instantly, needs crew sign-in through an online database (Supabase). That is the next step for the app.
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    section: { marginTop: spacing.lg },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    body: { color: c.text, fontSize: 15, marginBottom: spacing.md, lineHeight: 21 },
    note: { color: c.muted, fontSize: 12, marginTop: spacing.lg },
  });
