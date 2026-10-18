import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = { label: string; value: number; color: string };

export function Tile({ label, value, color }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  value: { fontSize: 32, fontWeight: '800' },
  label: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
