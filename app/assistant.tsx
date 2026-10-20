import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AiAnswer, askAssistant, ChatTurn, machineContext } from '../src/ai';
import { ManualLinks } from '../src/components/ManualLinks';
import { ProposalCard } from '../src/components/ProposalCard';
import { isOfficial } from '../src/manuals';
import { Button, ChipSelect, Input, Muted } from '../src/components/ui';
import { useStore } from '../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

type Message = { role: 'user' | 'assistant'; text: string; answer?: AiAnswer; error?: boolean };

const QUICK = [
  'What service is due and how do I do it?',
  'What are the fluid capacities and types?',
  'Lug nut / track / bolt torque specs?',
  'How do I grease this machine? Where are the fittings?',
];

/** Claude helper for one machine: questions while servicing, and filling specs and schedules. */
export default function AssistantScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string; mode?: string }>();
  const { assets, tasks, logs, thresholds, categoryOf } = useStore();
  const asset = assets.find((a) => a.id === params.assetId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const started = useRef(false);

  const missingModel = !!asset && !asset.model?.trim();

  const run = async (mode: 'chat' | 'setup', question?: string) => {
    if (!asset || busy) return;
    const userText = mode === 'setup' ? `Fill in the specs, parts and maintenance schedule for my ${asset.make ?? ''} ${asset.model ?? ''}.` : (question ?? '').trim();
    if (!userText) return;
    // Earlier turns as plain text (only complete question/answer pairs).
    const history: ChatTurn[] = [];
    messages.forEach((m, i) => {
      const next = messages[i + 1];
      if (m.role === 'user' && next?.role === 'assistant' && !next.error) {
        history.push({ role: 'user', text: m.text }, { role: 'assistant', text: next.text });
      }
    });
    setMessages((x) => [...x, { role: 'user', text: userText }]);
    setInput('');
    setBusy(true);
    try {
      const answer = await askAssistant({
        mode,
        fleetId: asset.fleetId,
        machine: machineContext(asset, categoryOf(asset), tasks, logs, thresholds),
        history,
        question: mode === 'chat' ? userText : undefined,
      });
      setMessages((x) => [...x, { role: 'assistant', text: answer.text || 'Here are my suggestions.', answer }]);
    } catch (e) {
      setMessages((x) => [...x, { role: 'assistant', text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // "Fill with AI" from the machine screen starts right away.
  useEffect(() => {
    if (params.mode === 'setup' && asset && !started.current && !missingModel) {
      started.current = true;
      run('setup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.mode, asset?.id]);

  if (!asset) {
    return (
      <View style={s.content}>
        <Muted>Machine not found.</Muted>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: 'AI helper' }} />
      <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.machine}>
          <Text style={s.machineName}>{asset.name}</Text>
          <Text style={s.machineMeta}>
            {[asset.make, asset.model, asset.year, asset.serial && `S/N ${asset.serial}`, `${asset.currentHours} h`].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {missingModel ? (
          <View style={s.warn}>
            <Text style={s.warnText}>Add the make and model (and serial number if you have it) so the helper can look up the right specs.</Text>
            <Button
              title="Edit machine"
              variant="secondary"
              onPress={() => router.push({ pathname: '/settings/machine/[id]', params: { id: asset.id } })}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}

        {messages.length === 0 && (
          <View>
            <Button title="✨ Fill specs & maintenance schedule" onPress={() => run('setup')} disabled={busy || missingModel} />
            <Text style={s.hint}>
              Looks up the manufacturer's schedule, capacities and part numbers for this model. You review everything before it's saved.
            </Text>
            <Text style={s.quickTitle}>Or ask about this machine</Text>
            <View style={{ marginBottom: spacing.md }}>
              <ChipSelect options={QUICK.map((q) => ({ value: q, label: q }))} value={undefined} onChange={(q) => run('chat', q)} />
            </View>
            <ManualLinks asset={asset} />
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === 'user' ? s.user : s.bot, m.error && s.errorBubble]}>
            <Text style={[s.text, m.role === 'user' && s.userText]} selectable>
              {m.text}
            </Text>
            {m.answer?.sources?.length ? (
              <View style={s.sources}>
                <Text style={s.sourcesTitle}>Sources</Text>
                {m.answer.sources.map((src) => (
                  <Pressable key={src.url} onPress={() => Linking.openURL(src.url)} accessibilityRole="link" style={s.sourceRow}>
                    <Text style={s.source} numberOfLines={1}>
                      {src.title}
                    </Text>
                    {isOfficial(src.url, asset.make) ? <Text style={s.badge}>OFFICIAL</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {m.answer?.proposal ? <ProposalCard asset={asset} proposal={m.answer.proposal} /> : null}
          </View>
        ))}
        {busy ? (
          <View style={s.thinking}>
            <ActivityIndicator color={c.accent} />
            <Text style={s.hint}>Looking it up… this can take up to a minute.</Text>
          </View>
        ) : null}
        <Text style={s.disclaimer}>AI answers can be wrong. Check torque values, capacities and part numbers against the manual or the decal on the machine.</Text>
      </ScrollView>

      <View style={s.bar}>
        <Input
          style={{ flex: 1 }}
          placeholder="Ask about this machine…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => run('chat', input)}
          returnKeyType="send"
          editable={!busy}
          multiline={false}
        />
        <Button title="Ask" onPress={() => run('chat', input)} disabled={busy || !input.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
    machine: { marginBottom: spacing.md },
    machineName: { color: c.text, fontSize: 20, fontWeight: '800' },
    machineMeta: { color: c.muted, fontSize: 14, marginTop: 2 },
    warn: { borderWidth: 1, borderColor: c.warn, borderRadius: radius, padding: spacing.md, marginBottom: spacing.md },
    warnText: { color: c.text, fontSize: 14 },
    hint: { color: c.muted, fontSize: 13, marginTop: spacing.sm },
    quickTitle: { color: c.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
    bubble: { borderRadius: radius, padding: spacing.md, marginBottom: spacing.sm, maxWidth: '100%' },
    user: { backgroundColor: c.accent, alignSelf: 'flex-end', maxWidth: '85%' },
    bot: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    errorBubble: { borderColor: c.danger },
    text: { color: c.text, fontSize: 15, lineHeight: 21 },
    userText: { color: c.onAccent, fontWeight: '600' },
    sources: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm },
    sourcesTitle: { color: c.muted, fontSize: 12, fontWeight: '800', marginBottom: 2 },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    source: { color: c.accent, fontSize: 13, paddingVertical: 3, flex: 1 },
    badge: { color: c.ok, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: c.ok, borderRadius: 4, paddingHorizontal: 4 },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
    disclaimer: { color: c.muted, fontSize: 11, marginTop: spacing.md, textAlign: 'center' },
    bar: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
  });
