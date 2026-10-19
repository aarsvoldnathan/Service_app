import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, Input, SectionTitle } from '../../../src/components/ui';
import { newId, useStore } from '../../../src/store';
import { Palette, spacing, touch, useStyles } from '../../../src/theme';
import { SpecField } from '../../../src/types';

/** Rename a category and choose which service spec lines it shows. */
export default function CategoryEditScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, saveCategory, deleteCategory } = useStore();
  const existing = categories.find((c) => c.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<SpecField[]>(existing?.fields.map((f) => ({ ...f })) ?? []);

  const setField = (i: number, patch: Partial<SpecField>) => setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setFields((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.length) return f;
      const next = [...f];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    const error = saveCategory({ id: existing?.id, name, fields });
    if (error) Alert.alert('Cannot save', error);
    else router.back();
  };

  const remove = () =>
    Alert.alert(`Delete ${existing?.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const error = deleteCategory(existing!.id);
          if (error) Alert.alert('Cannot delete', error);
          else router.back();
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: existing ? 'Edit category' : 'New category' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Category name" placeholder="e.g. Stump grinder" value={name} onChangeText={setName} />
        </Card>

        <View style={s.section}>
          <SectionTitle>Service spec lines</SectionTitle>
          <Text style={s.help}>These show on the record service screen for every machine in this category.</Text>
          {fields.map((f, i) => (
            <Card key={f.id} style={s.fieldCard}>
              <Input placeholder="Spec name (e.g. Blade bolt torque)" value={f.label} onChangeText={(v) => setField(i, { label: v })} />
              <Input
                style={{ marginTop: spacing.sm }}
                placeholder="Example value (optional)"
                value={f.placeholder ?? ''}
                onChangeText={(v) => setField(i, { placeholder: v || undefined })}
              />
              <View style={s.row}>
                <Button title="↑" variant="secondary" style={s.small} onPress={() => move(i, -1)} accessibilityLabel="Move up" />
                <Button title="↓" variant="secondary" style={s.small} onPress={() => move(i, 1)} accessibilityLabel="Move down" />
                <View style={{ flex: 1 }} />
                <Button title="Remove" variant="danger" onPress={() => setFields((x) => x.filter((_, j) => j !== i))} />
              </View>
            </Card>
          ))}
          <Button
            title="+ Add spec line"
            variant="secondary"
            onPress={() => setFields((x) => [...x, { id: `custom-${newId()}`, label: '' }])}
          />
        </View>

        <Button title="Save category" onPress={save} />
        {existing && existing.id !== 'other' ? (
          <Button title="Delete category" variant="danger" onPress={remove} style={{ marginTop: spacing.sm }} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    section: { marginTop: spacing.lg, marginBottom: spacing.md },
    help: { color: c.muted, fontSize: 14, marginBottom: spacing.sm },
    fieldCard: { marginBottom: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
    small: { width: touch, paddingHorizontal: 0 },
  });
