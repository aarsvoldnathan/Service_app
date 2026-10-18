import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DueInfo } from '../maintenance';
import { colors, radius, spacing } from '../theme';

export function DueRow({ item, onPress }: { item: DueInfo; onPress?: () => void }) {
  const color = item.status === 'overdue' ? colors.danger : colors.warn;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.task.name}, ${item.asset.name}, ${item.detail}`}
      style={({ pressed }) => [styles.row, { borderLeftColor: color }, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.main}>
        <Text style={styles.task}>{item.task.name}</Text>
        <Text style={styles.asset}>{item.asset.name}</Text>
      </View>
      <Text style={[styles.detail, { color }]}>{item.detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 64,
  },
  main: { marginBottom: spacing.xs },
  task: { color: colors.text, fontSize: 17, fontWeight: '700' },
  asset: { color: colors.muted, fontSize: 14, marginTop: 2 },
  detail: { fontSize: 14, fontWeight: '700' },
});
