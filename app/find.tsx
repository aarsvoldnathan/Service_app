import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ScannerModal } from '../src/components/ScannerModal';
import { Button, Field, ListRow, Muted, SectionTitle } from '../src/components/ui';
import { findAssets } from '../src/maintenance';
import { useStore } from '../src/store';
import { spacing, useStyles } from '../src/theme';

/** Find a machine by barcode scan, serial number or text search. */
export default function FindScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { assets, fleets, activeFleet, setCurrentAssetId, setPrefs } = useStore();
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);

  const fleetName = (id: string) => fleets.find((f) => f.id === id)?.name ?? '';
  // Machines in the active fleet first, then the rest.
  const results = findAssets(assets, query).sort(
    (a, b) => Number(b.fleetId === activeFleet.id) - Number(a.fleetId === activeFleet.id) || a.name.localeCompare(b.name),
  );

  const pick = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    if (asset.fleetId !== activeFleet.id) setPrefs({ activeFleetId: asset.fleetId });
    setCurrentAssetId(id);
    if (next === 'service') router.replace({ pathname: '/service', params: { assetId: id } });
    else router.back();
  };

  const onScanned = (code: string) => {
    setScanning(false);
    const matches = findAssets(assets, code).filter(
      (a) => a.barcode?.toLowerCase() === code.toLowerCase() || a.serial.toLowerCase() === code.toLowerCase(),
    );
    if (matches.length === 1) {
      pick(matches[0].id);
      return;
    }
    setQuery(code);
    Alert.alert('No machine with this code', `Scanned: ${code}`, [
      { text: 'OK', style: 'cancel' },
      {
        text: 'Add as new machine',
        onPress: () => router.push({ pathname: '/settings/machine/[id]', params: { id: 'new', barcode: code } }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Find machine' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Button title="Scan barcode or QR code" onPress={() => setScanning(true)} style={{ marginBottom: spacing.lg }} />
        <Field
          label="Search by name, serial number or barcode"
          placeholder="e.g. Kubota, KBT-L3901-48213"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <SectionTitle>{query ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'All machines'}</SectionTitle>
        {results.length === 0 ? (
          <Muted>No machines match. Add machines in Settings › Machines.</Muted>
        ) : (
          results.map((a) => (
            <ListRow
              key={a.id}
              title={a.name}
              subtitle={`Serial ${a.serial || '—'}${a.barcode ? ` · Code ${a.barcode}` : ''} · ${fleetName(a.fleetId)}`}
              right={`${a.currentHours} h`}
              onPress={() => pick(a.id)}
            />
          ))
        )}
      </ScrollView>
      <ScannerModal visible={scanning} onScanned={onScanned} onClose={() => setScanning(false)} />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
  });
