import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, ListRow } from '../../src/components/ui';
import { useStore } from '../../src/store';
import { spacing, useStyles } from '../../src/theme';

export default function FleetsScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { fleets, assets, activeFleet } = useStore();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Fleets' }} />
      <ScrollView contentContainerStyle={s.content}>
        {fleets.map((f) => (
          <ListRow
            key={f.id}
            title={`${f.name}${f.id === activeFleet.id ? '  (viewing)' : ''}`}
            subtitle={`${f.kind === 'work' ? 'Work' : 'Home'} · ${assets.filter((a) => a.fleetId === f.id).length} machines · ${f.memberIds.length} members`}
            onPress={() => router.push({ pathname: '/settings/fleet/[id]', params: { id: f.id } })}
          />
        ))}
        <Button title="+ Add fleet" onPress={() => router.push({ pathname: '/settings/fleet/[id]', params: { id: 'new' } })} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({ content: { padding: spacing.md, paddingBottom: spacing.lg * 3 } });
