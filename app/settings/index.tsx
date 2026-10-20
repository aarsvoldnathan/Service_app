import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ListRow, SectionTitle } from '../../src/components/ui';
import { useStore } from '../../src/store';
import { Palette, spacing, useStyles } from '../../src/theme';

export default function SettingsScreen({ embedded }: { embedded?: boolean } = {}) {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { fleets, assets, technicians, activeFleet, categories } = useStore();

  return (
    <View style={{ flex: 1 }}>
      {embedded ? null : <Stack.Screen options={{ title: 'Settings' }} />}
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.active}>Viewing: {activeFleet.name}</Text>

        <SectionTitle>Profiles</SectionTitle>
        <ListRow
          title="Fleets"
          subtitle="Work and home fleets, members and status rules"
          right={String(fleets.length)}
          onPress={() => router.push('/settings/fleets')}
        />
        <ListRow
          title="Machines"
          subtitle="Machine profiles, serial numbers, barcodes, schedules"
          right={String(assets.length)}
          onPress={() => router.push('/settings/machines')}
        />
        <ListRow
          title="Equipment categories"
          subtitle="Skid steer, excavator, trailer… and their spec lines"
          right={String(categories.length)}
          onPress={() => router.push('/settings/categories')}
        />
        <ListRow
          title="Technicians"
          subtitle="Employees and family members, hourly rates"
          right={String(technicians.length)}
          onPress={() => router.push('/settings/technicians')}
        />

        <View style={{ height: spacing.md }} />
        <SectionTitle>Crew</SectionTitle>
        <ListRow
          title="Crew & sharing"
          subtitle="Invite code, roles, join another crew"
          onPress={() => router.push('/settings/crew')}
        />

        <View style={{ height: spacing.md }} />
        <SectionTitle>Spreadsheets</SectionTitle>
        <ListRow
          title="Excel spreadsheet"
          subtitle="Import, link to OneDrive and keep in sync, download"
          onPress={() => router.push('/settings/excel')}
        />

        <View style={{ height: spacing.md }} />
        <SectionTitle>App</SectionTitle>
        <ListRow
          title="Preferences and invoices"
          subtitle="Theme, who uses this phone, business info for invoices"
          onPress={() => router.push('/settings/preferences')}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 5 },
    active: { color: c.muted, fontSize: 14, marginBottom: spacing.md },
  });
