import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCloud } from '../../src/cloud';
import { Button, Card, CheckRow, Field, Muted, SectionTitle } from '../../src/components/ui';
import { autoMap, templateMapping } from '../../src/sheets/core';
import { useExcel } from '../../src/sheets/ExcelLink';
import { appWorkbook, pickSpreadsheet, shareAppWorkbook, workbookToFile } from '../../src/sheets/files';
import { DriveFile, listWorkbooks, loadGraphBook, MS_REDIRECT, uploadNewWorkbook } from '../../src/sheets/microsoft';
import { useStore } from '../../src/store';
import { Palette, radius, spacing, useStyles, useTheme } from '../../src/theme';

const ago = (iso?: string) => (iso ? new Date(iso).toLocaleString() : 'never');

/** Link a fleet to an Excel spreadsheet: import, live OneDrive link, and export. */
export default function ExcelScreen() {
  const s = useStyles(makeStyles);
  const { c } = useTheme();
  const router = useRouter();
  const { activeFleet, assets, logs, tasks, categories } = useStore();
  const { myRole } = useCloud();
  const x = useExcel();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [clientInput, setClientInput] = useState(x.clientId);
  const canManage = myRole !== 'technician';
  const fleetAssets = assets.filter((a) => a.fleetId === activeFleet.id);
  const link = x.link;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Sign-in was cancelled.') Alert.alert('Excel', msg);
    } finally {
      setBusy(null);
    }
  };

  const importFile = () =>
    run('Opening the file…', async () => {
      const f = await pickSpreadsheet();
      if (!f) return;
      x.setPending({ book: f.book, mapping: autoMap(f.book, categories), source: 'file', fileName: f.fileName, localCopy: f.localCopy, ext: f.ext });
      router.push('/excel-review');
    });

  const findFiles = () => run('Looking in OneDrive…', async () => setFiles(await listWorkbooks(query)));

  const chooseDrive = (f: DriveFile) =>
    run('Reading the workbook…', async () => {
      const book = await loadGraphBook({ driveId: f.driveId, itemId: f.id, fileName: f.name });
      x.setPending({ book, mapping: autoMap(book, categories), source: 'onedrive', fileName: f.name, driveId: f.driveId, itemId: f.id, webUrl: f.webUrl });
      router.push('/excel-review');
    });

  const createWorkbook = () =>
    run('Creating the workbook…', async () => {
      const name = `${activeFleet.name.replace(/[^\w\- ]+/g, '')} - Service Ceo.xlsx`;
      const path = await workbookToFile(appWorkbook(fleetAssets, logs, tasks, categories), name);
      const f = await uploadNewWorkbook(path, name);
      const ids = new Set(fleetAssets.map((a) => a.id));
      x.saveLink({
        fleetId: activeFleet.id,
        source: 'onedrive',
        fileName: f.name,
        driveId: f.driveId,
        itemId: f.id,
        webUrl: f.webUrl,
        mapping: templateMapping(),
        knownLogIds: logs.filter((l) => ids.has(l.assetId)).map((l) => l.id),
        autoWrite: true,
        linkedAt: new Date().toISOString(),
      });
      Alert.alert('Workbook created', `"${f.name}" is in your OneDrive and linked to ${activeFleet.name}. Services you log will be added to it.`);
    });

  const exportAll = () => run('Making the spreadsheet…', () => shareAppWorkbook(appWorkbook(fleetAssets, logs, tasks, categories), activeFleet.name));

  const unlink = () =>
    Alert.alert('Unlink the spreadsheet?', 'The app and the spreadsheet both keep everything they have. They just stop updating each other.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: () => link && x.unlink(link.fleetId) },
    ]);

  if (!canManage) {
    return (
      <View style={s.content}>
        <Stack.Screen options={{ title: 'Excel spreadsheet' }} />
        <Muted>Only the fleet owner or a manager can link spreadsheets. Services you log still reach the linked spreadsheet through their phone.</Muted>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Excel spreadsheet' }} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.lead}>Fleet: {activeFleet.name}</Text>

        {busy ? (
          <View style={s.busy}>
            <ActivityIndicator color={c.accent} />
            <Text style={s.busyText}>{busy}</Text>
          </View>
        ) : null}

        {link ? (
          <Card style={{ marginBottom: spacing.lg, borderColor: c.accent, borderWidth: 2 }}>
            <Text style={s.cardTitle}>Linked: {link.fileName}</Text>
            <Text style={s.meta}>
              {link.source === 'onedrive' ? 'Live OneDrive / SharePoint workbook · syncs both ways' : 'File on this phone · download an updated copy any time'}
            </Text>
            <Text style={s.meta}>Last sync: {ago(link.lastSync)}</Text>
            {link.lastResult ? <Text style={s.ok}>{link.lastResult}</Text> : null}
            {link.lastError ? <Text style={s.err}>{link.lastError}</Text> : null}
            {link.source === 'onedrive' ? (
              <>
                <CheckRow
                  checked={link.autoWrite}
                  onToggle={() => x.setAutoWrite(!link.autoWrite)}
                  title="Write services and hours into the sheet"
                  detail="New services become new rows; higher hours update the machine's row."
                />
                <Button title={x.syncing ? 'Syncing…' : 'Sync now'} onPress={() => x.syncNow()} disabled={x.syncing} style={{ marginTop: spacing.sm }} />
                {link.webUrl ? <Button title="Open in Excel" variant="secondary" onPress={() => Linking.openURL(link.webUrl!)} style={{ marginTop: spacing.sm }} /> : null}
              </>
            ) : (
              <>
                <Button
                  title="Download updated copy"
                  onPress={() => run('Updating the copy…', async () => {
                    const msg = await x.shareUpdatedCopy();
                    Alert.alert('Updated copy', msg);
                  })}
                  style={{ marginTop: spacing.sm }}
                />
                <Button title="Import the file again" variant="secondary" onPress={importFile} style={{ marginTop: spacing.sm }} />
              </>
            )}
            <Button title="Unlink" variant="danger" onPress={unlink} style={{ marginTop: spacing.sm }} />
          </Card>
        ) : null}

        <SectionTitle>1. Import a spreadsheet</SectionTitle>
        <Muted>
          Choose an Excel (.xlsx) or CSV file from your phone, iCloud, OneDrive or Google Drive. The AI reads the columns, then you review the machines,
          hours and service history before anything is saved.
        </Muted>
        <Button title="Import Excel or CSV file" onPress={importFile} disabled={!!busy} style={{ marginTop: spacing.sm }} />

        <View style={{ height: spacing.lg }} />
        <SectionTitle>2. Live link to OneDrive / SharePoint</SectionTitle>
        <Muted>
          Keeps a workbook in OneDrive in step with the app: services logged in the app are added to the sheet, and rows added in Excel come into the
          app. Uses your Microsoft account.
        </Muted>
        {!x.clientId ? (
          <Card style={{ marginTop: spacing.sm }}>
            <Field
              label="Microsoft app (client) ID"
              value={clientInput}
              onChangeText={setClientInput}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoCapitalize="none"
              autoCorrect={false}
              hint={`One-time setup by the fleet owner (see the Excel setup roadmap). Redirect URI to register: ${MS_REDIRECT}`}
            />
            <Button
              title="Save"
              onPress={() => {
                if (!/^[0-9a-f-]{36}$/i.test(clientInput.trim())) return Alert.alert('Client ID', 'That doesn’t look like an app (client) ID. It has 36 characters, like 1a2b3c4d-....');
                x.setClientId(clientInput);
              }}
            />
          </Card>
        ) : !x.account ? (
          <Button title="Sign in with Microsoft" onPress={() => run('Signing in…', x.signIn)} disabled={!!busy} style={{ marginTop: spacing.sm }} />
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <View style={s.acctRow}>
              <Text style={s.meta}>Signed in as {x.account}</Text>
              <Pressable onPress={() => x.signOut()} accessibilityRole="button" hitSlop={8}>
                <Text style={s.link}>Sign out</Text>
              </Pressable>
            </View>
            <View style={s.searchRow}>
              <View style={{ flex: 1 }}>
                <Field label="Find a workbook" value={query} onChangeText={setQuery} placeholder="Name (blank = recent)" onSubmitEditing={findFiles} returnKeyType="search" />
              </View>
            </View>
            <Button title="Find my Excel workbooks" onPress={findFiles} disabled={!!busy} />
            {files ? (
              files.length === 0 ? (
                <Muted>No Excel workbooks found. Upload one to OneDrive or create one below.</Muted>
              ) : (
                files.map((f) => (
                  <Pressable key={f.id} onPress={() => chooseDrive(f)} style={s.file} accessibilityRole="button">
                    <Text style={s.fileName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Text style={s.meta}>{f.modified ? `Changed ${new Date(f.modified).toLocaleDateString()}` : ''}</Text>
                  </Pressable>
                ))
              )
            ) : null}
            <Button
              title="Create a new Service Ceo workbook in OneDrive"
              variant="secondary"
              onPress={createWorkbook}
              disabled={!!busy}
              style={{ marginTop: spacing.sm }}
            />
            <Pressable onPress={() => x.setClientId('')} hitSlop={8} style={{ marginTop: spacing.sm }}>
              <Text style={s.small}>Change Microsoft app ID</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: spacing.lg }} />
        <SectionTitle>3. Download a spreadsheet</SectionTitle>
        <Muted>All machines, service history, schedule, parts and specs for {activeFleet.name} as an Excel file. No wages or invoices are included.</Muted>
        <Button title="Download Service Ceo spreadsheet" variant="secondary" onPress={exportAll} disabled={!!busy} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    content: { padding: spacing.md, paddingBottom: spacing.lg * 3 },
    lead: { color: c.muted, fontSize: 14, marginBottom: spacing.md },
    busy: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
    busyText: { color: c.muted, fontSize: 14 },
    cardTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
    meta: { color: c.muted, fontSize: 13, marginTop: 2 },
    ok: { color: c.ok, fontSize: 13, marginTop: spacing.xs },
    err: { color: c.danger, fontSize: 13, marginTop: spacing.xs },
    acctRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    searchRow: { flexDirection: 'row', gap: spacing.sm },
    link: { color: c.accent, fontWeight: '700', fontSize: 14 },
    small: { color: c.muted, fontSize: 12, textDecorationLine: 'underline' },
    file: { borderWidth: 1, borderColor: c.border, borderRadius: radius, padding: spacing.md, marginTop: spacing.sm, backgroundColor: c.card },
    fileName: { color: c.text, fontSize: 15, fontWeight: '700' },
  });
