import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { newId, useStore } from './store';
import { friendlyError, Role, supabase } from './supabase';
import { AppData, Fleet, Technician } from './types';

// ---------- Mapping between the app's data and online rows ----------

type Collection =
  | 'categories'
  | 'technicians'
  | 'rates'
  | 'assets'
  | 'tasks'
  | 'logs'
  | 'assignments'
  | 'shopping'
  | 'jobs'
  | 'timeEntries'
  | 'expenses';

type Row = { fleet_id: string; collection: Collection; id: string; data: any; tech_id: string | null };
type ServerRow = Row & { deleted: boolean; updated_at: string };

/** JSON with sorted keys, so the same object always gives the same text. */
export function stable(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

export const keyOf = (r: { fleet_id: string; collection: string; id: string }) => `${r.fleet_id}|${r.collection}|${r.id}`;
export const hashOf = (r: { data: unknown; tech_id: string | null }) => `${stable(r.data)}#${r.tech_id ?? ''}`;

const PRIVATE: Collection[] = ['jobs', 'timeEntries', 'expenses', 'rates'];

/** Every record of the fleets that are online, as rows. */
export function rowsFromData(d: AppData, online: Map<string, Membership>): Map<string, Row> {
  const out = new Map<string, Row>();
  const add = (fleet: string | undefined, collection: Collection, id: string, data: unknown, tech?: string) => {
    if (!fleet || !online.has(fleet)) return;
    const row: Row = { fleet_id: fleet, collection, id, data, tech_id: tech ?? null };
    out.set(keyOf(row), row);
  };
  const assetFleet = new Map(d.assets.map((a) => [a.id, a.fleetId]));
  const jobFleet = new Map(
    d.jobs.map((j) => [j.id, j.fleetId ?? (j.assetId ? assetFleet.get(j.assetId) : undefined) ?? d.prefs.activeFleetId]),
  );
  const jobTech = new Map(d.jobs.map((j) => [j.id, j.technicianId]));
  const techs = new Map(d.technicians.map((t) => [t.id, t]));

  online.forEach((m, fleetId) => {
    // Equipment categories are managed by the owner and managers.
    if (m.role !== 'technician') d.categories.forEach((c) => add(fleetId, 'categories', c.id, c));
    const fleet = d.fleets.find((f) => f.id === fleetId);
    fleet?.memberIds.forEach((tid) => {
      const t = techs.get(tid);
      if (!t) return;
      const { hourlyRate, ...rest } = t;
      add(fleetId, 'technicians', t.id, rest);
      // Wages go in a separate private row that only the owner and that person can read.
      if (m.role === 'owner' && hourlyRate !== undefined) add(fleetId, 'rates', t.id, { hourlyRate }, t.id);
    });
  });
  d.assets.forEach((a) => add(a.fleetId, 'assets', a.id, a));
  d.tasks.forEach((t) => add(assetFleet.get(t.assetId), 'tasks', t.id, t));
  d.logs.forEach((l) => add(assetFleet.get(l.assetId), 'logs', l.id, l));
  d.assignments.forEach((a) => add(assetFleet.get(a.assetId), 'assignments', a.id, a));
  d.shopping.forEach((s) => add(s.fleetId, 'shopping', s.id, s));
  d.jobs.forEach((j) => add(jobFleet.get(j.id), 'jobs', j.id, { ...j, fleetId: jobFleet.get(j.id) }, j.technicianId));
  d.timeEntries.forEach((e) => add(jobFleet.get(e.jobId), 'timeEntries', e.id, e, e.technicianId ?? jobTech.get(e.jobId)));
  d.expenses.forEach((e) => add(jobFleet.get(e.jobId), 'expenses', e.id, e, e.technicianId ?? jobTech.get(e.jobId)));
  return out;
}

/** Put one online row into the app's data (or remove it). */
export function applyRow(d: AppData, r: ServerRow): AppData {
  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  const remove = <T extends { id: string }>(list: T[]) => list.filter((x) => x.id !== r.id);

  if (r.collection === 'rates') {
    return {
      ...d,
      technicians: d.technicians.map((t) =>
        t.id === r.id ? { ...t, hourlyRate: r.deleted ? undefined : (r.data?.hourlyRate as number | undefined) } : t,
      ),
    };
  }
  if (r.collection === 'technicians') {
    if (r.deleted) return { ...d, technicians: remove(d.technicians) };
    const prev = d.technicians.find((t) => t.id === r.id);
    return { ...d, technicians: upsert(d.technicians, { ...(r.data as Technician), hourlyRate: prev?.hourlyRate }) };
  }
  const key = r.collection as Exclude<Collection, 'rates' | 'technicians'>;
  const list = d[key] as { id: string }[];
  return { ...d, [key]: r.deleted ? remove(list) : upsert(list, r.data) };
}

/** Remove one record from the app's data (it was deleted online or is no longer visible). */
function dropLocal(d: AppData, collection: string, id: string): AppData {
  if (collection === 'rates') return { ...d, technicians: d.technicians.map((t) => (t.id === id ? { ...t, hourlyRate: undefined } : t)) };
  const key = collection as keyof AppData;
  const list = d[key];
  if (!Array.isArray(list)) return d;
  return { ...d, [key]: (list as { id: string }[]).filter((x) => x.id !== id) };
}

/** Remove a fleet and everything in it from this phone. */
function dropFleet(d: AppData, fleetId: string): AppData {
  const assetIds = new Set(d.assets.filter((a) => a.fleetId === fleetId).map((a) => a.id));
  const jobIds = new Set(d.jobs.filter((j) => j.fleetId === fleetId).map((j) => j.id));
  const fleets = d.fleets.filter((f) => f.id !== fleetId);
  return {
    ...d,
    fleets,
    assets: d.assets.filter((a) => a.fleetId !== fleetId),
    tasks: d.tasks.filter((t) => !assetIds.has(t.assetId)),
    logs: d.logs.filter((l) => !assetIds.has(l.assetId)),
    assignments: d.assignments.filter((a) => !assetIds.has(a.assetId)),
    shopping: d.shopping.filter((s) => s.fleetId !== fleetId),
    jobs: d.jobs.filter((j) => !jobIds.has(j.id)),
    timeEntries: d.timeEntries.filter((e) => !jobIds.has(e.jobId)),
    expenses: d.expenses.filter((e) => !jobIds.has(e.jobId)),
    prefs: d.prefs.activeFleetId === fleetId ? { ...d.prefs, activeFleetId: fleets[0]?.id ?? '' } : d.prefs,
  };
}

// ---------- Sync state saved on the phone ----------

type SyncState = {
  /** Newest server timestamp already pulled. */
  lastPull?: string;
  /** What each record looked like when last in sync: key -> hash and tech id. */
  meta: Record<string, { h: string; t: string | null }>;
  fleetHashes: Record<string, string>;
  /** Fleets this account has been a member of online. */
  knownRemote: string[];
};

const emptySync = (): SyncState => ({ meta: {}, fleetHashes: {}, knownRemote: [] });
const syncKey = (uid: string) => `service-ceo:sync:${uid}`;

// ---------- Context ----------

export type Membership = { fleetId: string; role: Role; technicianId?: string; inviteCode?: string };
export type CrewMember = {
  user_id: string;
  role: Role;
  technician_id: string | null;
  email: string | null;
  name: string | null;
  joined_at: string;
};

type CloudValue = {
  memberships: Map<string, Membership>;
  /** Your role in the fleet you are viewing. */
  myRole?: Role;
  isOwner: boolean;
  syncing: boolean;
  lastSync?: Date;
  syncError?: string;
  syncNow: (full?: boolean) => Promise<void>;
  /** Owner onboarding: put this phone's earlier data online under this account. */
  uploadPhoneData: (legacy: AppData, myName: string) => Promise<string | null>;
  startNewFleet: (name: string, kind: Fleet['kind'], myName: string) => Promise<string | null>;
  joinCrew: (code: string, myName: string) => Promise<string | null>;
  crew: (fleetId: string) => Promise<CrewMember[]>;
  setMemberRole: (fleetId: string, userId: string, role: Role) => Promise<string | null>;
  linkMember: (fleetId: string, userId: string, technicianId: string) => Promise<string | null>;
  removeMember: (fleetId: string, userId: string) => Promise<string | null>;
  newInviteCode: (fleetId: string) => Promise<string | null>;
  /** Owner: delete a fleet online (everyone loses access). */
  deleteFleetOnline: (fleetId: string) => Promise<void>;
};

const CloudContext = createContext<CloudValue | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const store = useStore();
  const { data, replaceData, ready } = store;

  const dataRef = useRef(data);
  dataRef.current = data;
  const state = useRef<SyncState>(emptySync());
  const [memberships, setMemberships] = useState<Map<string, Membership>>(new Map());
  const membershipsRef = useRef(memberships);
  membershipsRef.current = memberships;
  const running = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | undefined>();
  const [syncError, setSyncError] = useState<string | undefined>();
  const [stateLoaded, setStateLoaded] = useState(false);

  // Load what we knew about the last sync.
  useEffect(() => {
    if (!userId) return;
    setStateLoaded(false);
    AsyncStorage.getItem(syncKey(userId))
      .then((raw) => {
        state.current = raw ? { ...emptySync(), ...JSON.parse(raw) } : emptySync();
      })
      .catch(() => {
        state.current = emptySync();
      })
      .finally(() => setStateLoaded(true));
  }, [userId]);

  const saveState = useCallback(async () => {
    if (userId) await AsyncStorage.setItem(syncKey(userId), JSON.stringify(state.current)).catch(() => {});
  }, [userId]);

  /** Send local changes, then fetch everyone else's. */
  const sync = useCallback(
    async (full = false) => {
      if (!userId || running.current) return;
      running.current = true;
      setSyncing(true);
      try {
        const st = state.current;

        // 1. Which fleets am I in, and with what role?
        const { data: mem, error: memErr } = await supabase
          .from('fleet_members')
          .select('fleet_id, role, technician_id')
          .eq('user_id', userId);
        if (memErr) throw memErr;
        const { data: fleetRows, error: fleetErr } = await supabase.from('fleets').select('id, data, deleted, invite_code');
        if (fleetErr) throw fleetErr;
        const online = new Map<string, Membership>();
        (mem ?? []).forEach((m: any) => {
          const f = (fleetRows ?? []).find((x: any) => x.id === m.fleet_id);
          if (f && !f.deleted) {
            online.set(m.fleet_id, {
              fleetId: m.fleet_id,
              role: m.role,
              technicianId: m.technician_id ?? undefined,
              inviteCode: f.invite_code,
            });
          }
        });

        // 2. Fleets created on this phone that are not online yet: put them online (I own them).
        const before = dataRef.current;
        let d = before;
        const ops: ((x: AppData) => AppData)[] = [];
        const apply = (op: (x: AppData) => AppData) => {
          d = op(d);
          ops.push(op);
        };
        for (const f of d.fleets) {
          if (online.has(f.id) || st.knownRemote.includes(f.id)) continue;
          const { data: code, error } = await supabase.rpc('create_fleet', {
            p_id: f.id,
            p_data: f,
            p_technician_id: d.prefs.meTechnicianId ?? null,
          });
          if (error) throw error;
          online.set(f.id, { fleetId: f.id, role: 'owner', technicianId: d.prefs.meTechnicianId, inviteCode: code as string });
          st.fleetHashes[f.id] = stable(f);
        }

        // 3. Fleets I was removed from (or that were deleted): remove from this phone.
        for (const id of st.knownRemote) {
          if (!online.has(id) && d.fleets.some((f) => f.id === id)) apply((x) => dropFleet(x, id));
        }
        st.knownRemote = Array.from(online.keys());

        // 4. Pull first, so a phone never pushes stale data over newer data.
        const fullPull = full || !st.lastPull;
        const fleetIds = Array.from(online.keys());
        const pulled: ServerRow[] = [];
        if (fleetIds.length) {
          for (let from = 0; ; from += 1000) {
            let q = supabase
              .from('records')
              .select('fleet_id, collection, id, data, tech_id, deleted, updated_at')
              .in('fleet_id', fleetIds)
              .order('updated_at', { ascending: true })
              .range(from, from + 999);
            if (!fullPull) q = q.gt('updated_at', st.lastPull!);
            const { data: page, error } = await q;
            if (error) throw error;
            pulled.push(...((page ?? []) as ServerRow[]));
            if (!page || page.length < 1000) break;
          }
        }

        // 5. Apply fleets from the server (unless I have unsent changes as owner).
        (fleetRows ?? []).forEach((fr: any) => {
          const m = online.get(fr.id);
          if (!m) return;
          const local = d.fleets.find((f) => f.id === fr.id);
          const server: Fleet = { ...(fr.data as Fleet), id: fr.id };
          if (local && m.role === 'owner' && st.fleetHashes[fr.id] !== undefined && stable(local) !== st.fleetHashes[fr.id]) return;
          apply((x) => ({
            ...x,
            fleets: x.fleets.some((f) => f.id === fr.id) ? x.fleets.map((f) => (f.id === fr.id ? server : f)) : [...x.fleets, server],
          }));
          st.fleetHashes[fr.id] = stable(server);
        });

        // 6. Apply records. Local edits not yet sent win; they go up in the push below.
        const localRows = rowsFromData(d, online);
        const seen = new Set<string>();
        pulled.forEach((r) => {
          const k = keyOf(r);
          seen.add(k);
          if (!st.lastPull || r.updated_at > st.lastPull) st.lastPull = r.updated_at;
          const mine = localRows.get(k);
          if (mine && st.meta[k] && st.meta[k].h !== hashOf(mine)) return;
          apply((x) => applyRow(x, r));
          if (r.deleted) delete st.meta[k];
          else st.meta[k] = { h: '', t: r.tech_id }; // filled in below
        });

        // On a full pull, anything synced before but no longer online (deleted, or private to someone else) goes away.
        if (fullPull) {
          Object.keys(st.meta).forEach((k) => {
            if (seen.has(k) || !online.has(k.split('|')[0])) return;
            const [, collection, ...rest] = k.split('|');
            const id = rest.join('|');
            apply((x) => dropLocal(x, collection, id));
            delete st.meta[k];
          });
        }
        // Record pulled rows the way this phone turns them back into rows.
        const afterPull = rowsFromData(d, online);
        seen.forEach((k) => {
          const r = afterPull.get(k);
          if (r && st.meta[k] && st.meta[k].h === '') st.meta[k] = { h: hashOf(r), t: r.tech_id };
          else if (!r && st.meta[k]?.h === '') delete st.meta[k];
        });

        // 7. Make sure "me" matches this account's technician profile in the fleet I'm viewing.
        const firstOnline = online.values().next().value as Membership | undefined;
        if (firstOnline && !d.fleets.some((f) => f.id === d.prefs.activeFleetId)) {
          const id = firstOnline.fleetId;
          apply((x) => ({ ...x, prefs: { ...x.prefs, activeFleetId: id } }));
        }
        const activeM = online.get(d.prefs.activeFleetId);
        if (activeM?.technicianId && d.prefs.meTechnicianId !== activeM.technicianId) {
          const tid = activeM.technicianId;
          apply((x) => ({ ...x, prefs: { ...x.prefs, meTechnicianId: tid } }));
        }

        // 8. Push fleet settings (owner only).
        for (const f of d.fleets) {
          const m = online.get(f.id);
          if (m?.role !== 'owner') continue;
          const h = stable(f);
          if (st.fleetHashes[f.id] === h) continue;
          const { error } = await supabase.from('fleets').update({ data: f }).eq('id', f.id);
          if (!error) st.fleetHashes[f.id] = h;
        }

        // 9. Push changed and deleted records.
        const rows = rowsFromData(d, online);
        const changed = Array.from(rows.values()).filter((r) => st.meta[keyOf(r)]?.h !== hashOf(r));
        const removed = Object.keys(st.meta)
          .filter((k) => !rows.has(k) && online.has(k.split('|')[0]))
          .map((k) => {
            const [fleet_id, collection, ...rest] = k.split('|');
            return { fleet_id, collection, id: rest.join('|'), data: {}, tech_id: st.meta[k].t, deleted: true };
          });
        const send = async (batch: object[]) => {
          if (!batch.length) return [] as object[];
          const { error } = await supabase.from('records').upsert(batch, { onConflict: 'fleet_id,collection,id' });
          if (!error) return batch;
          // One row we may not write (e.g. someone else's job) should not block the rest.
          const ok: object[] = [];
          for (const one of batch) {
            const { error: e1 } = await supabase.from('records').upsert(one, { onConflict: 'fleet_id,collection,id' });
            if (!e1) ok.push(one);
          }
          return ok;
        };
        const pending = [...changed.map((r) => ({ ...r, deleted: false })), ...removed];
        for (let i = 0; i < pending.length; i += 200) {
          const batch = pending.slice(i, i + 200);
          await send(batch);
          // Rows that were refused are not retried; the server copy wins on the next full pull.
          batch.forEach((r: any) => {
            const k = keyOf(r);
            if (r.deleted) delete st.meta[k];
            else st.meta[k] = { h: hashOf(r), t: r.tech_id };
          });
        }

        if (ops.length) {
          // If the person changed something while we were syncing, apply the server changes on top of it.
          replaceData((cur) => (cur === before ? d : ops.reduce((acc, op) => op(acc), cur)));
        }
        setMemberships(online);
        await saveState();
        setLastSync(new Date());
        setSyncError(undefined);
      } catch (e) {
        setSyncError(friendlyError(e));
      } finally {
        running.current = false;
        setSyncing(false);
      }
    },
    [userId, replaceData, saveState],
  );

  // Sync on start, every 20 seconds while open, when the app comes back, and shortly after changes.
  useEffect(() => {
    if (!ready || !stateLoaded || !userId) return;
    sync(true);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') sync();
    }, 20_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, stateLoaded, userId, sync]);

  useEffect(() => {
    if (!ready || !stateLoaded || !data.fleets.length) return;
    const t = setTimeout(() => sync(), 2000);
    return () => clearTimeout(t);
  }, [data, ready, stateLoaded, sync]);

  // ----- Onboarding -----

  const myTechId = userId ? `tech-${userId.replace(/-/g, '')}` : undefined;

  const uploadPhoneData = useCallback(
    async (legacy: AppData, myName: string) => {
      if (!userId || !myTechId) return 'Not signed in.';
      // Give fleets new ids so they never clash with another owner's fleets online.
      const map = new Map(legacy.fleets.map((f) => [f.id, `f-${newId()}`]));
      const re = (id?: string) => (id ? map.get(id) ?? id : id);
      let me = legacy.prefs.meTechnicianId;
      let technicians = legacy.technicians;
      if (!me || !technicians.some((t) => t.id === me)) {
        me = myTechId;
        technicians = [...technicians, { id: me, name: myName || 'Owner', role: 'Owner' }];
      }
      const d: AppData = {
        ...legacy,
        technicians,
        fleets: legacy.fleets.map((f) => ({
          ...f,
          id: map.get(f.id)!,
          memberIds: f.memberIds.includes(me!) ? f.memberIds : [...f.memberIds, me!],
        })),
        assets: legacy.assets.map((a) => ({ ...a, fleetId: re(a.fleetId)! })),
        shopping: legacy.shopping.map((s) => ({ ...s, fleetId: re(s.fleetId)! })),
        jobs: legacy.jobs.map((j) => ({ ...j, fleetId: re(j.fleetId) ?? map.get(legacy.prefs.activeFleetId) })),
        prefs: { ...legacy.prefs, meTechnicianId: me, activeFleetId: re(legacy.prefs.activeFleetId) ?? '' },
      };
      try {
        for (const f of d.fleets) {
          const { error } = await supabase.rpc('create_fleet', { p_id: f.id, p_data: f, p_technician_id: me });
          if (error) throw error;
        }
      } catch (e) {
        return friendlyError(e);
      }
      replaceData(() => d);
      setTimeout(() => sync(true), 300);
      return null;
    },
    [userId, myTechId, replaceData, sync],
  );

  const startNewFleet = useCallback(
    async (name: string, kind: Fleet['kind'], myName: string) => {
      if (!userId || !myTechId) return 'Not signed in.';
      if (!name.trim()) return 'Enter a fleet name.';
      const fleet: Fleet = {
        id: `f-${newId()}`,
        name: name.trim(),
        kind,
        memberIds: [myTechId],
        staleHoursDays: 7,
        orangeOverdueHours: 10,
        majorWarnHours: 10,
      };
      const { error } = await supabase.rpc('create_fleet', { p_id: fleet.id, p_data: fleet, p_technician_id: myTechId });
      if (error) return friendlyError(error);
      replaceData((d) => ({
        ...d,
        fleets: [...d.fleets, fleet],
        technicians: d.technicians.some((t) => t.id === myTechId)
          ? d.technicians
          : [...d.technicians, { id: myTechId, name: myName || 'Owner', role: 'Owner' }],
        prefs: { ...d.prefs, activeFleetId: fleet.id, meTechnicianId: myTechId },
      }));
      setTimeout(() => sync(true), 300);
      return null;
    },
    [userId, myTechId, replaceData, sync],
  );

  const joinCrew = useCallback(
    async (code: string, myName: string) => {
      if (!code.trim()) return 'Enter the invite code.';
      const { data: res, error } = await supabase.rpc('join_fleet', { p_code: code, p_name: myName });
      if (error) return friendlyError(error);
      const r = res as { fleet_id: string; technician_id: string };
      replaceData((d) => ({ ...d, prefs: { ...d.prefs, activeFleetId: r.fleet_id, meTechnicianId: r.technician_id } }));
      await sync(true);
      return null;
    },
    [replaceData, sync],
  );

  // ----- Crew management (the database only allows the owner to change roles) -----

  const crew = useCallback(async (fleetId: string) => {
    const { data: rows, error } = await supabase.rpc('fleet_crew', { p_fleet: fleetId });
    if (error) throw new Error(friendlyError(error));
    return (rows ?? []) as CrewMember[];
  }, []);

  const setMemberRole = useCallback(async (fleetId: string, uid: string, role: Role) => {
    const { error } = await supabase.from('fleet_members').update({ role }).eq('fleet_id', fleetId).eq('user_id', uid);
    return error ? friendlyError(error) : null;
  }, []);

  const linkMember = useCallback(
    async (fleetId: string, uid: string, technicianId: string) => {
      const { error } = await supabase
        .from('fleet_members')
        .update({ technician_id: technicianId })
        .eq('fleet_id', fleetId)
        .eq('user_id', uid);
      if (error) return friendlyError(error);
      // Make sure that technician profile is a member of the fleet.
      replaceData((d) => ({
        ...d,
        fleets: d.fleets.map((f) =>
          f.id === fleetId && !f.memberIds.includes(technicianId) ? { ...f, memberIds: [...f.memberIds, technicianId] } : f,
        ),
      }));
      return null;
    },
    [replaceData],
  );

  const removeMember = useCallback(
    async (fleetId: string, uid: string) => {
      const { error } = await supabase.from('fleet_members').delete().eq('fleet_id', fleetId).eq('user_id', uid);
      if (error) return friendlyError(error);
      if (uid === userId) await sync(true);
      return null;
    },
    [userId, sync],
  );

  const newInviteCode = useCallback(
    async (fleetId: string) => {
      const { data: code, error } = await supabase.rpc('new_invite_code', { p_fleet: fleetId });
      if (error) return null;
      setMemberships((m) => {
        const next = new Map(m);
        const cur = next.get(fleetId);
        if (cur) next.set(fleetId, { ...cur, inviteCode: code as string });
        return next;
      });
      return code as string;
    },
    [],
  );

  const deleteFleetOnline = useCallback(
    async (fleetId: string) => {
      if (membershipsRef.current.get(fleetId)?.role !== 'owner') return;
      await supabase.from('fleets').delete().eq('id', fleetId);
      state.current.knownRemote = state.current.knownRemote.filter((x) => x !== fleetId);
      await saveState();
    },
    [saveState],
  );

  const myRole = memberships.get(data.prefs.activeFleetId)?.role;

  const value = useMemo<CloudValue>(
    () => ({
      memberships,
      myRole,
      isOwner: myRole === 'owner',
      syncing,
      lastSync,
      syncError,
      syncNow: (full?: boolean) => sync(full),
      uploadPhoneData,
      startNewFleet,
      joinCrew,
      crew,
      setMemberRole,
      linkMember,
      removeMember,
      newInviteCode,
      deleteFleetOnline,
    }),
    [memberships, myRole, syncing, lastSync, syncError, sync, uploadPhoneData, startNewFleet, joinCrew, crew, setMemberRole, linkMember, removeMember, newInviteCode, deleteFleetOnline],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudValue {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error('useCloud must be used inside <CloudProvider>');
  return ctx;
}

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', manager: 'Manager', technician: 'Technician' };
export { PRIVATE as PRIVATE_COLLECTIONS };
