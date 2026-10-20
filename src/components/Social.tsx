// Building blocks for the feed-style home page: machine "stories", feed cards and the bottom bar.
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Level } from '../maintenance';
import { Palette, spacing, useStyles, useTheme } from '../theme';
import { levelColor } from './ui';

/** Re-renders every `ms` so running clocks tick. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "Bobcat T66 #2" -> "T6". Two characters for the circle. */
export function initials(name: string): string {
  const words = name.replace(/[^\w\s#-]/g, '').split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '?';
  const model = words.find((w) => /\d/.test(w));
  if (model) return model.slice(0, 3).toUpperCase();
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Round avatar with a status ring, like a story bubble. */
export function Avatar({ label, level, size = 64, dim }: { label: string; level?: Level; size?: number; dim?: boolean }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const ring = level ? levelColor(c, level) : c.border;
  return (
    <View style={[s.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderColor: ring, opacity: dim ? 0.6 : 1 }]}>
      <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[s.avatarText, { fontSize: size * 0.3 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export type Story = { id: string; name: string; level: Level; onPress: () => void };

export function StoriesRow({ stories, onAdd }: { stories: Story[]; onAdd: () => void }) {
  const s = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stories}>
      <Pressable onPress={onAdd} style={s.story} accessibilityRole="button" accessibilityLabel="Add a machine">
        <View style={s.addRing}>
          <Text style={s.addPlus}>+</Text>
        </View>
        <Text style={s.storyName} numberOfLines={1}>
          Add
        </Text>
      </Pressable>
      {stories.map((st) => (
        <Pressable
          key={st.id}
          onPress={st.onPress}
          style={s.story}
          accessibilityRole="button"
          accessibilityLabel={`${st.name}, ${st.level === 'green' ? 'up to date' : 'needs service'}`}
        >
          <Avatar label={initials(st.name)} level={st.level} />
          <Text style={s.storyName} numberOfLines={1}>
            {st.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** One post in the feed: who/what, the news, and one or two actions. */
export function FeedCard({
  title,
  meta,
  level,
  avatar,
  body,
  detail,
  actions,
  onPress,
}: {
  title: string;
  meta?: string;
  level?: Level;
  avatar: string;
  body: string;
  detail?: string;
  actions?: { label: string; onPress: () => void; primary?: boolean }[];
  onPress?: () => void;
}) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
      <View style={s.cardHead}>
        <Avatar label={avatar} level={level} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          {meta ? <Text style={s.cardMeta}>{meta}</Text> : null}
        </View>
      </View>
      <Text style={[s.cardBody, level && level !== 'green' ? { color: levelColor(c, level) } : null]}>{body}</Text>
      {detail ? <Text style={s.cardDetail}>{detail}</Text> : null}
      {actions?.length ? (
        <View style={s.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} style={[s.action, a.primary && s.actionPrimary]} accessibilityRole="button" hitSlop={4}>
              <Text style={[s.actionText, a.primary && s.actionTextPrimary]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

type Tab = 'home' | 'find' | 'log' | 'time' | 'more';

/** Bottom navigation: Home · Find · + · Time · Settings. */
export function BottomBar({ active, timeBadge }: { active: Tab; timeBadge?: boolean }) {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items: { key: Tab; icon: string; label: string; go: () => void }[] = [
    { key: 'home', icon: '⌂', label: 'Home', go: () => router.replace('/') },
    { key: 'find', icon: '⌕', label: 'Find', go: () => router.push({ pathname: '/find', params: { next: 'service' } }) },
    { key: 'log', icon: '+', label: 'Log service', go: () => router.push('/service') },
    { key: 'time', icon: '◷', label: 'Time clock', go: () => router.push('/jobs') },
    { key: 'more', icon: '☰', label: 'Settings', go: () => router.push('/settings') },
  ];
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((it) =>
        it.key === 'log' ? (
          <Pressable key={it.key} onPress={it.go} style={s.barItem} accessibilityRole="button" accessibilityLabel={it.label}>
            <View style={s.plus}>
              <Text style={s.plusText}>+</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable key={it.key} onPress={it.go} style={s.barItem} accessibilityRole="button" accessibilityLabel={it.label}>
            <Text style={[s.barIcon, { color: active === it.key ? c.text : c.muted }]}>{it.icon}</Text>
            {it.key === 'time' && timeBadge ? <View style={s.badge} /> : null}
          </Pressable>
        ),
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    ring: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    avatar: { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg },
    avatarText: { color: c.text, fontWeight: '800' },
    stories: { gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    story: { alignItems: 'center', width: 76 },
    storyName: { color: c.text, fontSize: 12, marginTop: 4, maxWidth: 76, textAlign: 'center' },
    addRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPlus: { color: c.muted, fontSize: 30, fontWeight: '300' },
    card: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    cardTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    cardMeta: { color: c.muted, fontSize: 12 },
    cardBody: { color: c.text, fontSize: 18, fontWeight: '700', lineHeight: 24 },
    cardDetail: { color: c.muted, fontSize: 14, marginTop: 4 },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    action: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border },
    actionPrimary: { backgroundColor: c.accent, borderColor: c.accent },
    actionText: { color: c.text, fontSize: 14, fontWeight: '700' },
    actionTextPrimary: { color: c.onAccent },
    bar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.bg,
      paddingTop: 8,
    },
    barItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    barIcon: { fontSize: 26, fontWeight: '600' },
    plus: { width: 44, height: 32, borderRadius: 10, borderWidth: 2, borderColor: c.text, alignItems: 'center', justifyContent: 'center' },
    plusText: { color: c.text, fontSize: 22, fontWeight: '700', marginTop: -2 },
    badge: { position: 'absolute', top: 6, right: '32%', width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  });
