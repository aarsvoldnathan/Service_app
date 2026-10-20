import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ListRow } from '../../src/components/ui';
import { useStore } from '../../src/store';
import { Palette, spacing, useStyles } from '../../src/theme';

export default function CategoriesScreen() {
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { categories, assets } = useStore();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Equipment categories' }} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.help}>Each category has its own service spec lines. Tap one to rename it or change its specs.</Text>
        {categories.map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${c.fields.length} spec lines · ${assets.filter((a) => a.category === c.id).length} machines`}
            onPress={() => router.push({ pathname: '/settings/category/[id]', params: { id: c.id } })}
          />
        ))}
        <Button
          title="+ Add category"
          onPress={() => router.push({ pathname: '/settings/category/[id]', params: { id: 'new' } })}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    help: { color: c.muted, fontSize: 14, marginBottom: spacing.md },
  });
