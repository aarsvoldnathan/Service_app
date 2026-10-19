import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Palette, radius, spacing, useStyles } from '../theme';

type Props = { label: string; value: number; color: string; onPress?: () => void };

export function Tile({ label, value, color, onPress }: Props) {
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.value, { color }]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    value: { fontSize: 32, fontWeight: '800' },
    label: {
      color: c.muted,
      fontSize: 12,
      marginTop: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
    },
  });
