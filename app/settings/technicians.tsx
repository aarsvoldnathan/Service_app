import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, ListRow, Muted } from '../../src/components/ui';
import { useStore } from '../../src/store';
import { spacing, useStyles } from '../../src/theme';

export default function TechniciansScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { technicians, fleets, prefs } = useStore();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Technicians' }} />
      <ScrollView contentContainerStyle={s.content}>
        {technicians.length === 0 ? <Muted>No technicians yet.</Muted> : null}
        {technicians.map((t) => {
          const inFleets = fleets.filter((f) => f.memberIds.includes(t.id)).map((f) => f.name);
          return (
            <ListRow
              key={t.id}
              title={`${t.name}${prefs.meTechnicianId === t.id ? '  (me)' : ''}`}
              subtitle={[t.role, inFleets.join(', ') || 'No fleets'].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/settings/technician/[id]', params: { id: t.id } })}
            />
          );
        })}
        <Button
          title="+ Add technician"
          onPress={() => router.push({ pathname: '/settings/technician/[id]', params: { id: 'new' } })}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({ content: { padding: spacing.md, paddingBottom: spacing.lg * 3 } });
