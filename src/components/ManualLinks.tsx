import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { manualLinks } from '../manuals';
import { Palette, radius, spacing, useStyles } from '../theme';
import { Asset } from '../types';

/** Free "Manufacturer documents" links for a machine. No AI, no cost. */
export function ManualLinks({ asset }: { asset: Asset }) {
  const s = useStyles(makeStyles);
  const links = manualLinks(asset);
  if (!links.length) return null;
  return (
    <View style={s.card}>
      <Text style={s.title}>Manufacturer documents</Text>
      <Text style={s.sub}>Free lookups on the maker's own site. Check the serial-number range on the manual cover.</Text>
      {links.map((l) => (
        <Pressable key={l.url} onPress={() => Linking.openURL(l.url)} accessibilityRole="link" style={s.row}>
          <Text style={s.link} numberOfLines={1}>
            {l.label}
          </Text>
          {l.official ? <Text style={s.badge}>OFFICIAL</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { borderWidth: 1, borderColor: c.border, borderRadius: radius, padding: spacing.md, backgroundColor: c.card, marginTop: spacing.sm },
    title: { color: c.text, fontSize: 17, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 13, marginTop: 2, marginBottom: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: spacing.sm },
    link: { color: c.accent, fontSize: 15, fontWeight: '700', flex: 1 },
    badge: { color: c.ok, fontSize: 11, fontWeight: '800', borderWidth: 1, borderColor: c.ok, borderRadius: 4, paddingHorizontal: 4 },
  });
