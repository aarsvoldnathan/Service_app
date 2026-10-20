import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChipSelect, Field, HeaderButton, Muted, SectionTitle } from '../src/components/ui';
import { useStore } from '../src/store';
import { Palette, radius, spacing, useStyles } from '../src/theme';
import { ShoppingItem } from '../src/types';

const GENERAL = '__general';

export default function ShoppingScreen() {
  const s = useStyles(makeStyles);
  const params = useLocalSearchParams<{ assetId?: string }>();
  const { shopping, activeFleet, fleetAssets, prefs, technicianName, saveShoppingItem, toggleShoppingItem, deleteShoppingItem, clearPurchased } =
    useStore();

  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [qty, setQty] = useState('1');
  const [assetId, setAssetId] = useState<string>(params.assetId ?? GENERAL);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const items = shopping.filter((i) => i.fleetId === activeFleet.id);
  const open = items.filter((i) => !i.purchased);
  const bought = items.filter((i) => i.purchased);
  const machineName = (id?: string) => fleetAssets.find((a) => a.id === id)?.name;

  const resetForm = () => {
    setName('');
    setPartNumber('');
    setQty('1');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (i: ShoppingItem) => {
    setName(i.name);
    setPartNumber(i.partNumber ?? '');
    setQty(i.quantity ?? '');
    setAssetId(i.assetId ?? GENERAL);
    setNotes(i.notes ?? '');
    setEditingId(i.id);
    setShowForm(true);
  };

  const save = () => {
    const existing = items.find((i) => i.id === editingId);
    const error = saveShoppingItem({
      ...existing,
      id: editingId ?? undefined,
      fleetId: activeFleet.id,
      name,
      partNumber: partNumber.trim() || undefined,
      quantity: qty.trim() || undefined,
      assetId: assetId === GENERAL ? undefined : assetId,
      notes: notes.trim() || undefined,
      addedBy: existing?.addedBy ?? (prefs.meTechnicianId ? technicianName(prefs.meTechnicianId) : undefined),
    });
    if (error) Alert.alert('Cannot save', error);
    else resetForm();
  };

  const share = () => {
    const lines = open.map(
      (i) =>
        `• ${i.quantity ? `${i.quantity} × ` : ''}${i.name}${i.partNumber ? ` (${i.partNumber})` : ''}${machineName(i.assetId) ? ` - ${machineName(i.assetId)}` : ''}`,
    );
    Share.share({ message: `${activeFleet.name} shopping list\n\n${lines.join('\n') || 'Nothing needed.'}` });
  };

  const remove = (i: ShoppingItem) =>
    Alert.alert(`Remove ${i.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteShoppingItem(i.id) },
    ]);

  const row = (i: ShoppingItem) => (
    <View key={i.id} style={[s.item, i.purchased && s.itemDone]}>
      <Pressable
        onPress={() => toggleShoppingItem(i.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: i.purchased }}
        accessibilityLabel={`${i.name}, ${i.purchased ? 'bought' : 'needed'}`}
        style={[s.box, i.purchased && s.boxOn]}
        hitSlop={8}
      >
        {i.purchased ? <Text style={s.tick}>✓</Text> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => startEdit(i)} onLongPress={() => remove(i)} accessibilityHint="Tap to edit, hold to remove">
        <Text style={[s.itemName, i.purchased && s.strike]}>
          {i.quantity ? `${i.quantity} × ` : ''}
          {i.name}
        </Text>
        {i.partNumber ? <Text style={s.part}>{i.partNumber}</Text> : null}
        <Text style={s.meta}>
          {[machineName(i.assetId), i.addedBy && `added by ${i.addedBy}`, i.notes].filter(Boolean).join(' · ') || 'General'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          title: 'Shopping list',
          headerRight: () => <HeaderButton title="Share" label="Share shopping list" onPress={share} />,
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {showForm ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Field label="Part or item" placeholder="e.g. Fuel filter, hydraulic hose" value={name} onChangeText={setName} />
            <View style={s.two}>
              <View style={{ flex: 2 }}>
                <Field label="Part number" autoCapitalize="characters" value={partNumber} onChangeText={setPartNumber} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Qty" value={qty} onChangeText={setQty} />
              </View>
            </View>
            <Text style={s.label}>For machine</Text>
            <ChipSelect
              options={[{ value: GENERAL, label: 'General' }, ...fleetAssets.map((a) => ({ value: a.id, label: a.name }))]}
              value={assetId}
              onChange={setAssetId}
            />
            <View style={{ height: spacing.md }} />
            <Field label="Notes" placeholder="Where to buy, urgency" value={notes} onChangeText={setNotes} />
            <View style={s.two}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={resetForm} />
              <Button title={editingId ? 'Save' : 'Add to list'} style={{ flex: 1 }} onPress={save} />
            </View>
            {editingId ? (
              <Button
                title="Remove item"
                variant="danger"
                style={{ marginTop: spacing.sm }}
                onPress={() => {
                  deleteShoppingItem(editingId);
                  resetForm();
                }}
              />
            ) : null}
          </Card>
        ) : (
          <Button title="+ Add item" onPress={() => setShowForm(true)} style={{ marginBottom: spacing.lg }} />
        )}

        <SectionTitle>{`Needed (${open.length})`}</SectionTitle>
        {open.length === 0 ? <Muted>Nothing on the list.</Muted> : open.map(row)}

        {bought.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle
              right={
                <Pressable onPress={() => clearPurchased(activeFleet.id)} accessibilityRole="button" hitSlop={8}>
                  <Text style={s.clear}>Clear</Text>
                </Pressable>
              }
            >
              {`Bought (${bought.length})`}
            </SectionTitle>
            {bought.map(row)}
          </View>
        )}
        <Text style={s.hint}>Tap the box when bought. Tap an item to edit it, hold to remove it.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    two: { flexDirection: 'row', gap: spacing.sm },
    label: { color: c.muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    itemDone: { opacity: 0.6 },
    box: { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: c.ok, borderColor: c.ok },
    tick: { color: '#fff', fontSize: 18, fontWeight: '900' },
    itemName: { color: c.text, fontSize: 17, fontWeight: '700' },
    strike: { textDecorationLine: 'line-through' },
    part: { color: c.accent, fontSize: 15, fontWeight: '800', marginTop: 2 },
    meta: { color: c.muted, fontSize: 13, marginTop: 2 },
    clear: { color: c.danger, fontSize: 14, fontWeight: '700' },
    hint: { color: c.muted, fontSize: 12, marginTop: spacing.lg, textAlign: 'center' },
  });
