import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, ChipSelect, levelColor, ListRow, Muted } from '../../src/components/ui';
import { machineStatus } from '../../src/maintenance';
import { useStore } from '../../src/store';
import { spacing, useStyles, useTheme } from '../../src/theme';

export default function MachinesScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { assets, fleets, tasks, activeFleet } = useStore();
  const [fleetId, setFleetId] = useState<string>(activeFleet.id);

  const list = assets.filter((a) => fleetId === 'all' || a.fleetId === fleetId).sort((a, b) => a.name.localeCompare(b.name));
  const fleetOf = (id: string) => fleets.find((f) => f.id === id);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Machines' }} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelect
            options={[{ value: 'all', label: 'All fleets' }, ...fleets.map((f) => ({ value: f.id, label: f.name }))]}
            value={fleetId}
            onChange={setFleetId}
          />
        </View>
        {list.length === 0 ? <Muted>No machines here yet.</Muted> : null}
        {list.map((a) => {
          const f = fleetOf(a.fleetId);
          const th = f ? { orangeOverdueHours: f.orangeOverdueHours, majorWarnHours: f.majorWarnHours } : undefined;
          return (
            <ListRow
              key={a.id}
              title={a.name}
              subtitle={`Serial ${a.serial || '—'}${a.barcode ? ` · Code ${a.barcode}` : ' · No barcode'}${fleetId === 'all' ? ` · ${f?.name ?? ''}` : ''}`}
              right={`${a.currentHours} h`}
              dot={levelColor(c, machineStatus(a, tasks, new Date(), th).level)}
              onPress={() => router.push({ pathname: '/settings/machine/[id]', params: { id: a.id } })}
            />
          );
        })}
        <Button
          title="+ Add machine"
          onPress={() =>
            router.push({ pathname: '/settings/machine/[id]', params: { id: 'new', fleetId: fleetId === 'all' ? activeFleet.id : fleetId } })
          }
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({ content: { padding: spacing.md, paddingBottom: spacing.lg * 3 } });
