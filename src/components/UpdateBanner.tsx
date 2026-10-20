import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ANDROID_BUILD, ANDROID_DOWNLOAD, GITHUB_REPO } from '../config';
import { Palette, radius, spacing, useStyles } from '../theme';
import { Button } from './ui';

type Latest = { build: number; url: string; notes?: string };

/** On Android, checks GitHub for a newer app build and offers to download it. */
export function UpdateBanner() {
  const s = useStyles(makeStyles);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !ANDROID_BUILD) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return;
        const releases: any[] = await res.json();
        const best = releases
          .map((r) => ({ r, n: Number(/^android-(\d+)$/.exec(r.tag_name ?? '')?.[1] ?? 0) }))
          .filter((x) => x.n > 0)
          .sort((a, b) => b.n - a.n)[0];
        if (!best || best.n <= ANDROID_BUILD) return;
        const apk = (best.r.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
        const subject = /\*\*Latest change:\*\* (.+)/.exec(best.r.body ?? '')?.[1];
        if (alive) setLatest({ build: best.n, url: apk?.browser_download_url ?? ANDROID_DOWNLOAD, notes: subject });
      } catch {
        // Offline or GitHub unavailable: try again next launch.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!latest || hidden) return null;

  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.title}>Update available</Text>
      <Text style={s.body}>
        Build {latest.build} is ready (you have build {ANDROID_BUILD}).{latest.notes ? `\n${latest.notes}` : ''}
      </Text>
      <Text style={s.small}>Download it, then open the file and tap Update. Your data stays.</Text>
      <View style={s.row}>
        <Button title="Download update" onPress={() => Linking.openURL(latest.url)} style={{ flex: 1 }} />
        <Pressable onPress={() => setHidden(true)} accessibilityRole="button" hitSlop={8} style={s.later}>
          <Text style={s.laterText}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    banner: {
      borderWidth: 2,
      borderColor: c.accent,
      backgroundColor: c.card,
      borderRadius: radius,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    title: { color: c.accent, fontSize: 17, fontWeight: '800' },
    body: { color: c.text, fontSize: 15, marginTop: spacing.xs },
    small: { color: c.muted, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    later: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    laterText: { color: c.muted, fontSize: 16, fontWeight: '700' },
  });
