import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DueInfo } from '../maintenance';
import { Palette, radius, spacing, useStyles, useTheme } from '../theme';
import { levelColor } from './ui';

export function DueRow({ item, onPress }: { item: DueInfo; onPress?: () => void }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const color = levelColor(c, item.level);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.task.name}, ${item.asset.name}, ${item.detail}`}
      style={({ pressed }) => [s.row, { borderLeftColor: color }, pressed && { opacity: 0.7 }]}
    >
      <View style={s.main}>
        <Text style={s.task}>{item.task.name}</Text>
        <Text style={s.asset}>{item.asset.name}</Text>
      </View>
      <Text style={[s.detail, { color }]}>{item.detail}</Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderLeftWidth: 5,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.sm,
      minHeight: 64,
    },
    main: { marginBottom: spacing.xs },
    task: { color: c.text, fontSize: 17, fontWeight: '700' },
    asset: { color: c.muted, fontSize: 14, marginTop: 2 },
    detail: { fontSize: 14, fontWeight: '700' },
  });
