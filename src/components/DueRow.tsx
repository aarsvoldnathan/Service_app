import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DueInfo } from '../maintenance';
import { colors, radius, spacing } from '../theme';

export function DueRow({ item }: { item: DueInfo }) {
  const color = item.status === 'overdue' ? colors.danger : colors.warn;
  return (
    <View style={[styles.row, { borderLeftColor: color }]}>
      <View style={styles.main}>
        <Text style={styles.task}>{item.task.name}</Text>
        <Text style={styles.asset}>{item.asset.name}</Text>
      </View>
      <Text style={[styles.detail, { color }]}>{item.detail}</Text>
    </View>
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
