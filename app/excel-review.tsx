import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { askSheetMapping } from '../src/ai';
import { Button, Card, CheckRow, ChipSelect, Muted, SectionTitle } from '../src/components/ui';
import { applyPlan } from '../src/sheets/apply';
import {
  buildImportPlan,
  cleanMapping,
  colLetter,
  FIELD_LABEL,
  headersOf,
  LOG_FIELDS,
  MACHINE_FIELDS,
  SheetMapping,
  usDate,
} from '../src/sheets/core';
import { useExcel } from '../src/sheets/ExcelLink';
import { useStore } from '../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../src/theme';

type Kind = 'machines' | 'logs';

/** Check how a spreadsheet was read, adjust the columns, preview the changes, then apply. */
export default function ExcelReview() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const store = useStore();
  const { activeFleet, assets, logs, categories, saveAsset, replaceData } = store;
  const x = useExcel();
  const p = x.pending;
  const [mapping, setMapping] = useState<SheetMapping>(p?.mapping ?? {});
  const [aiState, setAiState] = useState<'idle' | 'busy' | 'done' | 'off' | 'error'>('idle');
  const [aiNote, setAiNote] = useState<string | undefined>();
  const [editing, setEditing] = useState<string | null>(null);
  const [choice, setChoice] = useState({ newMachines: true, updates: true, logs: true });
  const [keepLinked, setKeepLinked] = useState(true);
  const [writeBack, setWriteBack] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const started = useRef(false);

  const fleetAssets = useMemo(() => assets.filter((a) => a.fleetId === activeFleet.id), [assets, activeFleet.id]);
  const plan = useMemo(
    () => (p ? buildImportPlan(p.book, mapping, fleetAssets, logs, categories) : null),
    [p, mapping, fleetAssets, logs, categories],
  );

  const askAi = async () => {
    if (!p) return;
    setAiState('busy');
    try {
      const specFields = Array.from(new Map(categories.flatMap((cat) => cat.fields).map((f) => [f.id, { id: f.id, label: f.label }])).values());
      const r = await askSheetMapping({
        fleetId: activeFleet.id,
        fileName: p.fileName,
        sheets: p.book.sheets.map((g) => ({ name: g.name, rows: g.rows })),
        specFields,
        categories: categories.map((cat) => ({ id: cat.id, name: cat.name })),
      });
      const m = cleanMapping(r.mapping, p.book, categories);
      if (m) {
        setMapping(m);
        setAiNote(m.notes || r.text);
        setAiState('done');
      } else {
        setAiState('error');
        setAiNote('The AI could not find a machine list or service log. Check the columns below.');
      }
    } catch (e) {
      const msg = (e as Error).message;
      setAiState(msg === 'not_configured' ? 'off' : 'error');
      setAiNote(msg === 'not_configured' ? 'AI is not switched on yet, so the columns were matched automatically. Check them below.' : msg);
    }
  };

  // Let the AI read the sheet as soon as the screen opens.
  useEffect(() => {
    if (p && !started.current) {
      started.current = true;
      askAi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  if (!p || !plan) {
    return (
      <View style={s.content}>
        <Stack.Screen options={{ title: 'Review spreadsheet' }} />
        <Muted>Nothing to review. Open Settings › Excel spreadsheet and choose a file.</Muted>
      </View>
    );
  }

  const sheetNames = p.book.sheets.map((g) => g.name);
  const setTable = (kind: Kind, patch: { sheet?: string; headerRow?: number; columns?: Record<string, number | undefined> } | null) =>
    setMapping((m) => {
      if (patch === null) return { ...m, [kind]: undefined };
      const cur = m[kind] ?? { sheet: sheetNames[0], headerRow: 0, columns: {} };
      return { ...m, [kind]: { ...cur, ...patch } } as SheetMapping;
    });

  const freshLogs = plan.logs.filter((l) => !l.duplicate);
  const dupes = plan.logs.length - freshLogs.length;
  const total = (choice.newMachines ? plan.newMachines.length : 0) + (choice.updates ? plan.updatedMachines.length : 0) + (choice.logs ? freshLogs.length : 0);

  const apply = () => {
    const r = applyPlan({ saveAsset, replaceData }, plan, activeFleet.id, choice);
    if (keepLinked) {
      x.saveLink({
        fleetId: activeFleet.id,
        source: p.source,
        fileName: p.fileName,
        localCopy: p.localCopy,
        ext: p.ext,
        driveId: p.driveId,
        itemId: p.itemId,
        webUrl: p.webUrl,
        mapping,
        knownLogIds: r.logIds,
        autoWrite: p.source === 'onedrive' ? writeBack : false,
        linkedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        lastResult: `Imported ${r.machinesAdded} machine(s), ${r.machinesUpdated} update(s), ${r.logsAdded} service(s)`,
      });
    }
    x.setPending(null);
    Alert.alert(
      'Imported',
      [
        `${r.machinesAdded} new machine(s), ${r.machinesUpdated} updated, ${r.logsAdded} service(s) added.`,
        r.errors.length ? `Not added: ${r.errors.join('; ')}` : '',
        keepLinked && p.source === 'onedrive' && writeBack ? 'The workbook will now be kept in sync with the app.' : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
    router.back();
  };

  const tableCard = (kind: Kind) => {
    const t = mapping[kind];
    const fields = (kind === 'machines' ? MACHINE_FIELDS : LOG_FIELDS) as readonly string[];
    const headers = t ? headersOf(p.book, t.sheet, t.headerRow) : [];
    const colName = (i?: number) => (i === undefined ? '—' : `${colLetter(i)}: ${headers[i] || ''}`);
    return (
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={s.cardTitle}>{kind === 'machines' ? 'Machine list' : 'Service history'}</Text>
        <Text style={s.meta}>Sheet</Text>
        <ChipSelect
          options={[{ value: '__none', label: 'None' }, ...sheetNames.map((n) => ({ value: n, label: n }))]}
          value={t?.sheet ?? '__none'}
          onChange={(v) => setTable(kind, v === '__none' ? null : { sheet: v, columns: t?.sheet === v ? t.columns : {} })}
        />
        {t ? (
          <>
            <View style={s.headerRow}>
              <Text style={s.meta}>Header row: {t.headerRow + 1}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="−" variant="secondary" onPress={() => setTable(kind, { headerRow: Math.max(0, t.headerRow - 1) })} />
                <Button title="+" variant="secondary" onPress={() => setTable(kind, { headerRow: t.headerRow + 1 })} />
              </View>
            </View>
            {fields.map((f) => {
              const k = `${kind}:${f}`;
              const col = (t.columns as Record<string, number | undefined>)[f];
              return (
                <View key={f}>
                  <Pressable onPress={() => setEditing(editing === k ? null : k)} style={s.fieldRow} accessibilityRole="button">
                    <Text style={s.fieldLabel}>{FIELD_LABEL[f] ?? f}</Text>
                    <Text style={[s.fieldCol, col === undefined && { color: c.muted }]} numberOfLines={1}>
                      {colName(col)}
                    </Text>
                  </Pressable>
                  {editing === k ? (
                    <ChipSelect
                      options={[{ value: '-1', label: '— none —' }, ...headers.map((h, i) => ({ value: String(i), label: `${colLetter(i)}: ${h}` }))]}
                      value={col === undefined ? '-1' : String(col)}
                      onChange={(v) => {
                        const cols = { ...t.columns } as Record<string, number | undefined>;
                        if (v === '-1') delete cols[f];
                        else cols[f] = Number(v);
                        setTable(kind, { columns: cols });
                        setEditing(null);
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
            {kind === 'machines' && Object.keys(mapping.machines?.specs ?? {}).length ? (
              <Text style={s.meta}>Spec columns: {Object.entries(mapping.machines!.specs!).map(([id, i]) => `${FIELD_LABEL[id] ?? id} (${colLetter(i)})`).join(', ')}</Text>
            ) : null}
          </>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Review spreadsheet' }} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.file}>{p.fileName}</Text>
        <Text style={s.meta}>
          {p.book.sheets.length} sheet(s) · into fleet {activeFleet.name} · {p.source === 'onedrive' ? 'live OneDrive workbook' : 'file'}
        </Text>

        <View style={s.ai}>
          {aiState === 'busy' ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <ActivityIndicator color={c.accent} />
              <Text style={s.aiText}>AI is reading the spreadsheet…</Text>
            </View>
          ) : (
            <>
              <Text style={s.aiText}>
                {aiState === 'done' ? '✨ Read by AI. ' : mapping.by === 'auto' ? 'Matched automatically. ' : ''}
                {aiNote ?? ''}
              </Text>
              {aiState !== 'done' && aiState !== 'off' ? <Button title="✨ Let AI read it again" variant="secondary" onPress={askAi} style={{ marginTop: spacing.sm }} /> : null}
            </>
          )}
        </View>

        <SectionTitle>Columns</SectionTitle>
        <Muted>Tap a line to change which column it comes from.</Muted>
        <View style={{ height: spacing.sm }} />
        {tableCard('machines')}
        {tableCard('logs')}

        <SectionTitle>What will change</SectionTitle>
        <CheckRow
          checked={choice.newMachines}
          onToggle={() => setChoice((v) => ({ ...v, newMachines: !v.newMachines }))}
          title={`Add ${plan.newMachines.length} new machine(s)`}
          detail={plan.newMachines.slice(0, 6).map((m) => [m.name, m.model, m.serial && `S/N ${m.serial}`, m.hours !== undefined && `${m.hours} h`].filter(Boolean).join(' · ')).join('\n') || undefined}
        />
        <CheckRow
          checked={choice.updates}
          onToggle={() => setChoice((v) => ({ ...v, updates: !v.updates }))}
          title={`Update ${plan.updatedMachines.length} machine(s) already in the app`}
          detail={plan.updatedMachines.slice(0, 6).map((m) => `${m.name}: ${m.changes.join(', ')}`).join('\n') || 'Only blank details are filled in and hours only go up.'}
        />
        <CheckRow
          checked={choice.logs}
          onToggle={() => setChoice((v) => ({ ...v, logs: !v.logs }))}
          title={`Add ${freshLogs.length} service record(s)`}
          detail={[
            freshLogs.slice(0, 6).map((l) => `${usDate(l.date)} · ${l.taskName}${l.hours ? ` · ${l.hours} h` : ''}`).join('\n'),
            dupes ? `${dupes} already in the app (skipped)` : '',
            freshLogs.length > 6 ? `…and ${freshLogs.length - 6} more` : '',
          ]
            .filter(Boolean)
            .join('\n')}
        />
        {plan.skipped.length ? (
          <Pressable onPress={() => setShowSkipped((v) => !v)} style={{ paddingVertical: spacing.sm }}>
            <Text style={s.warn}>
              {plan.skipped.length} row(s) can't be read {showSkipped ? '▲' : '▼'}
            </Text>
            {showSkipped ? plan.skipped.slice(0, 30).map((t) => <Text key={t} style={s.meta}>{t}</Text>) : null}
          </Pressable>
        ) : null}

        <View style={{ height: spacing.md }} />
        <SectionTitle>After importing</SectionTitle>
        <CheckRow
          checked={keepLinked}
          onToggle={() => setKeepLinked((v) => !v)}
          title="Keep this spreadsheet linked to the fleet"
          detail={p.source === 'onedrive' ? 'The app checks the workbook every few minutes while open.' : 'Download an updated copy any time from Settings › Excel spreadsheet.'}
        />
        {p.source === 'onedrive' && keepLinked ? (
          <CheckRow
            checked={writeBack}
            onToggle={() => setWriteBack((v) => !v)}
            title="Write the app's services and hours into the workbook"
            detail="Adds rows for services that aren't in the sheet yet and updates hours. Nothing in the sheet is deleted."
          />
        ) : null}

        <Button title={total ? `Import ${total} change(s)` : keepLinked ? 'Link without importing' : 'Nothing to import'} onPress={apply} disabled={!total && !keepLinked} style={{ marginTop: spacing.md }} />
        <Button title="Cancel" variant="secondary" onPress={() => { x.setPending(null); router.back(); }} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    file: { color: c.text, fontSize: 20, fontWeight: '800' },
    meta: { color: c.muted, fontSize: 13, marginTop: 2 },
    ai: { borderWidth: 1, borderColor: c.accent, borderRadius: radius, padding: spacing.md, marginVertical: spacing.md },
    aiText: { color: c.text, fontSize: 14 },
    cardTitle: { color: c.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.xs },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, borderTopWidth: 1, borderTopColor: c.border, gap: spacing.sm },
    fieldLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    fieldCol: { color: c.accent, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
    warn: { color: c.warn, fontSize: 14, fontWeight: '700' },
  });
