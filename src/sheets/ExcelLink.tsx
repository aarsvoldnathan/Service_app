// Keeps a fleet linked to an Excel workbook. For a OneDrive/SharePoint workbook it syncs both ways
// on its own: new services and hours go into the sheet, rows typed into the sheet come into the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { applyPlan } from './apply';
import { Book, buildImportPlan, computeWriteback, SheetMapping } from './core';
import { applyToWorkbook, readLocalCopy, saveWorkbookTo, shareWorkbook } from './files';
import { applyGraphWriteback, initMicrosoft, loadGraphBook, msAccount, signInMicrosoft, signOutMicrosoft } from './microsoft';

export type ExcelLink = {
  fleetId: string;
  source: 'file' | 'onedrive';
  fileName: string;
  /** File link: the saved copy on this phone and its type. */
  localCopy?: string;
  ext?: string;
  /** OneDrive link. */
  driveId?: string;
  itemId?: string;
  webUrl?: string;
  mapping: SheetMapping;
  /** Services already in the sheet (written by the app or imported from it). */
  knownLogIds: string[];
  /** Write app changes into the sheet automatically (OneDrive only). */
  autoWrite: boolean;
  linkedAt: string;
  lastSync?: string;
  lastResult?: string;
  lastError?: string;
};

/** A spreadsheet waiting on the review screen. */
export type PendingImport = {
  book: Book;
  mapping: SheetMapping;
  source: 'file' | 'onedrive';
  fileName: string;
  localCopy?: string;
  ext?: string;
  driveId?: string;
  itemId?: string;
  webUrl?: string;
};

type Saved = { links: Record<string, ExcelLink>; clientId?: string };

type Value = {
  ready: boolean;
  link?: ExcelLink;
  clientId: string;
  setClientId: (id: string) => void;
  account?: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  saveLink: (l: ExcelLink) => void;
  unlink: (fleetId: string) => void;
  setAutoWrite: (on: boolean) => void;
  syncing: boolean;
  syncNow: () => Promise<void>;
  /** File link: write changes into the saved copy and open the share sheet. */
  shareUpdatedCopy: () => Promise<string>;
  pending: PendingImport | null;
  setPending: (p: PendingImport | null) => void;
};

const Ctx = createContext<Value | null>(null);

export function ExcelProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const store = useStore();
  const { data, saveAsset, replaceData } = store;
  const key = `service-ceo:excel:${userId ?? 'local'}`;
  const [saved, setSaved] = useState<Saved>({ links: {} });
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const busy = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    let alive = true;
    (async () => {
      let s: Saved = { links: {} };
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) s = { links: {}, ...JSON.parse(raw) };
      } catch {
        // start empty
      }
      const acct = await initMicrosoft(userId ?? 'local', s.clientId);
      if (!alive) return;
      setSaved(s);
      setAccount(acct);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [key, userId]);

  const persist = useCallback(
    (fn: (s: Saved) => Saved) => {
      setSaved((prev) => {
        const next = fn(prev);
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [key],
  );

  const fleetId = data.prefs.activeFleetId;
  const link = saved.links[fleetId];

  const patchLink = useCallback(
    (fid: string, patch: Partial<ExcelLink>) =>
      persist((s) => (s.links[fid] ? { ...s, links: { ...s.links, [fid]: { ...s.links[fid], ...patch } } } : s)),
    [persist],
  );

  const syncLink = useCallback(
    async (l: ExcelLink) => {
      if (l.source !== 'onedrive' || !l.driveId || !l.itemId || busy.current) return;
      busy.current = true;
      setSyncing(true);
      try {
        const d = dataRef.current;
        const book = await loadGraphBook({ driveId: l.driveId, itemId: l.itemId, fileName: l.fileName });
        const assets = d.assets.filter((a) => a.fleetId === l.fleetId);
        const known = new Set(l.knownLogIds);
        const notes: string[] = [];
        const w = computeWriteback(book, l.mapping, assets, d.logs, d.categories, known);
        if (l.autoWrite && (w.edits.length || w.appends.length)) {
          await applyGraphWriteback({ driveId: l.driveId, itemId: l.itemId }, book, w);
          notes.push(`Wrote ${w.appends.length} new row${w.appends.length === 1 ? '' : 's'}${w.edits.length ? ` and ${w.edits.length} hour update${w.edits.length === 1 ? '' : 's'}` : ''} to the sheet`);
        }
        // Rows typed into the sheet come into the app.
        const plan = buildImportPlan(book, l.mapping, assets, d.logs, d.categories);
        const freshLogs = plan.logs.filter((x) => !x.duplicate).length;
        let pulledIds: string[] = [];
        if (plan.newMachines.length || plan.updatedMachines.length || freshLogs) {
          const r = applyPlan({ saveAsset, replaceData }, plan, l.fleetId);
          pulledIds = r.logIds;
          notes.push(`Brought in ${[r.machinesAdded && `${r.machinesAdded} machine(s)`, r.machinesUpdated && `${r.machinesUpdated} update(s)`, r.logsAdded && `${r.logsAdded} service(s)`].filter(Boolean).join(', ')} from the sheet`);
        }
        patchLink(l.fleetId, {
          knownLogIds: Array.from(new Set([...l.knownLogIds, ...(l.autoWrite ? w.logIds : []), ...pulledIds])),
          lastSync: new Date().toISOString(),
          lastResult: notes.join('. ') || 'Up to date',
          lastError: undefined,
        });
      } catch (e) {
        patchLink(l.fleetId, { lastError: (e as Error).message, lastSync: new Date().toISOString() });
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    },
    [patchLink, saveAsset, replaceData],
  );

  const syncNow = useCallback(async () => {
    const l = savedRef.current.links[dataRef.current.prefs.activeFleetId];
    if (l) await syncLink(l);
  }, [syncLink]);

  // Sync on its own: shortly after services or hours change, every 3 minutes, and when the app opens.
  const onedrive = Object.values(saved.links).filter((l) => l.source === 'onedrive');
  const signature = useMemo(
    () =>
      onedrive
        .map((l) => {
          const a = data.assets.filter((x) => x.fleetId === l.fleetId);
          const ids = new Set(a.map((x) => x.id));
          return `${l.fleetId}:${a.length}:${a.reduce((n, x) => n + x.currentHours, 0)}:${data.logs.filter((x) => ids.has(x.assetId)).length}`;
        })
        .join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.assets, data.logs, onedrive.length],
  );
  useEffect(() => {
    if (!ready || !signature) return;
    const t = setTimeout(() => {
      Object.values(savedRef.current.links)
        .filter((l) => l.source === 'onedrive')
        .reduce((p, l) => p.then(() => syncLink(l)), Promise.resolve());
    }, 8000);
    return () => clearTimeout(t);
  }, [signature, ready, syncLink]);
  useEffect(() => {
    if (!ready) return;
    const all = () =>
      Object.values(savedRef.current.links)
        .filter((l) => l.source === 'onedrive')
        .reduce((p, l) => p.then(() => syncLink(l)), Promise.resolve());
    const iv = setInterval(all, 180000);
    const sub = AppState.addEventListener('change', (s: string) => s === 'active' && all());
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [ready, syncLink]);

  const shareUpdatedCopy = useCallback(async () => {
    const l = savedRef.current.links[dataRef.current.prefs.activeFleetId];
    if (!l || l.source !== 'file' || !l.localCopy) throw new Error('No spreadsheet file is linked to this fleet.');
    const d = dataRef.current;
    const { wb, book } = await readLocalCopy(l.localCopy, l.ext ?? 'xlsx', l.fileName);
    const assets = d.assets.filter((a) => a.fleetId === l.fleetId);
    const w = computeWriteback(book, l.mapping, assets, d.logs, d.categories, new Set(l.knownLogIds));
    applyToWorkbook(wb, book, w);
    await shareWorkbook(wb, l.fileName, l.ext ?? 'xlsx');
    await saveWorkbookTo(wb, l.localCopy, l.ext ?? 'xlsx');
    patchLink(l.fleetId, { lastSync: new Date().toISOString(), lastResult: w.summary.length ? `${w.summary.length} change(s) in the copy` : 'No changes since import' });
    return w.summary.length ? `${w.summary.length} change(s) added.` : 'No new changes — the copy matches your file.';
  }, [patchLink]);

  const value: Value = {
    ready,
    link,
    clientId: saved.clientId ?? '',
    setClientId: (id) => {
      persist((s) => ({ ...s, clientId: id.trim() }));
      initMicrosoft(userId ?? 'local', id.trim()).then(setAccount);
    },
    account,
    signIn: async () => setAccount(await signInMicrosoft()),
    signOut: async () => {
      await signOutMicrosoft();
      setAccount(msAccount());
    },
    saveLink: (l) => persist((s) => ({ ...s, links: { ...s.links, [l.fleetId]: l } })),
    unlink: (fid) =>
      persist((s) => {
        const links = { ...s.links };
        delete links[fid];
        return { ...s, links };
      }),
    setAutoWrite: (on) => link && patchLink(link.fleetId, { autoWrite: on }),
    syncing,
    syncNow,
    shareUpdatedCopy,
    pending,
    setPending,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcel(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useExcel must be used inside ExcelProvider');
  return v;
}
