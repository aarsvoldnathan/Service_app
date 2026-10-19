import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_THRESHOLDS, Thresholds } from './maintenance';
import { buildSeedData, defaultRoutineTasks } from './seedData';
import { findTemplate, scheduleFromTemplate, templateLabel } from './templates';
import { ThemeProvider } from './theme';
import {
  AppData,
  Asset,
  AssetSpecs,
  Assignment,
  Fleet,
  NewServiceLog,
  Preferences,
  ServiceLog,
  ServiceTask,
  Technician,
} from './types';

const STORAGE_KEY = 'service-ceo:v1';

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type Result = string | null; // error message, or null on success

type StoreValue = AppData & {
  ready: boolean;
  activeFleet: Fleet;
  /** Machines in the active fleet. */
  fleetAssets: Asset[];
  thresholds: Thresholds;
  /** Machine currently open on the service screen (shared with the find screen). */
  currentAssetId?: string;
  setCurrentAssetId: (id: string | undefined) => void;

  updateHours: (assetId: string, hours: number) => Result;
  addServiceLog: (entry: NewServiceLog) => Result;
  updateSpecs: (assetId: string, specs: AssetSpecs) => void;

  saveAsset: (asset: Omit<Asset, 'id'> & { id?: string }) => { error: Result; id?: string };
  deleteAsset: (id: string) => void;
  /** Replace a machine's schedule with a factory template. */
  applyTemplate: (assetId: string, templateId: string) => void;
  /** Add machines from templates: { templateId: count }. Returns how many were added. */
  quickAdd: (fleetId: string, counts: Record<string, number>) => number;
  saveTask: (task: Omit<ServiceTask, 'id'> & { id?: string }) => Result;
  deleteTask: (id: string) => void;

  saveFleet: (fleet: Omit<Fleet, 'id'> & { id?: string }) => { error: Result; id?: string };
  deleteFleet: (id: string) => Result;
  saveTechnician: (tech: Omit<Technician, 'id'> & { id?: string }) => { error: Result; id?: string };
  deleteTechnician: (id: string) => void;

  saveAssignment: (a: Omit<Assignment, 'id'> & { id?: string }) => Result;
  toggleChecklistItem: (assignmentId: string, itemId: string) => void;
  setAssignmentStatus: (assignmentId: string, status: Assignment['status']) => void;
  deleteAssignment: (id: string) => void;

  setPrefs: (patch: Partial<Preferences>) => void;
  technicianName: (id?: string) => string;
  resetDemoData: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

// ---------- Loading and upgrading saved data ----------

const DEMO_IDS = new Set(['a1', 'a2', 'a3']);
const isSampleSpecs = (s?: Partial<AssetSpecs>) =>
  !!s &&
  [s.lugNutTorque, s.tirePressure, s.oilCapacity, s.oilType, ...(s.filters ?? []).map((f) => f.partNumber)]
    .filter(Boolean)
    .some((v) => /sample/i.test(v as string));

const guessKind = (name: string): ServiceTask['kind'] =>
  /grease|check|clean|inspect|wash/i.test(name) ? 'routine' : 'major';

/** Turn whatever is in storage (old or new format) into the current format. */
function upgrade(raw: any): AppData {
  if (raw?.version === 2) {
    const seed = buildSeedData();
    const data = raw as AppData;
    const fleets = data.fleets?.length ? data.fleets : seed.fleets;
    return {
      version: 2,
      fleets,
      technicians: data.technicians ?? [],
      assets: (data.assets ?? []).map((a) => ({ ...a, specs: { ...a.specs, filters: a.specs?.filters ?? [] } })),
      tasks: data.tasks ?? [],
      logs: data.logs ?? [],
      assignments: data.assignments ?? [],
      prefs: {
        ...seed.prefs,
        ...data.prefs,
        activeFleetId: fleets.some((f) => f.id === data.prefs?.activeFleetId)
          ? data.prefs.activeFleetId
          : fleets[0].id,
      },
    };
  }

  // Version 1 (builds 1-5): no fleets, technicians or schedule types.
  const oldAssets: any[] = raw?.assets ?? [];
  const oldLogs: ServiceLog[] = raw?.logs ?? [];
  const oldTasks: any[] = raw?.tasks ?? [];

  if (oldAssets.every((a) => DEMO_IDS.has(a.id))) {
    // Only demo machines: load the new demo (researched schedules), keep what testers logged.
    const seed = buildSeedData();
    const seedLogIds = new Set(seed.logs.map((l) => l.id));
    seed.logs = [...oldLogs.filter((l) => !seedLogIds.has(l.id)), ...seed.logs];
    seed.assets = seed.assets.map((a) => {
      const old = oldAssets.find((o) => o.id === a.id);
      if (!old) return a;
      const keepHours = old.currentHours > a.currentHours;
      return {
        ...a,
        currentHours: keepHours ? old.currentHours : a.currentHours,
        hoursUpdatedAt: keepHours ? old.hoursUpdatedAt : a.hoursUpdatedAt,
        specs: old.specs && !isSampleSpecs(old.specs) ? { ...old.specs, filters: old.specs.filters ?? [] } : a.specs,
      };
    });
    return seed;
  }

  // Real machines entered by hand: wrap them in one fleet and add the 10-hour items.
  const fleetId = 'f-main';
  const names = Array.from(new Set(oldLogs.map((l) => l.performedBy).filter(Boolean)));
  const technicians: Technician[] = names.map((name, i) => ({ id: `tech-m${i}`, name }));
  const tasks: ServiceTask[] = oldTasks.map((t) => ({ ...t, kind: t.kind ?? guessKind(t.name) }));
  oldAssets.forEach((a) => {
    defaultRoutineTasks(a.id, a.currentHours).forEach((t) => {
      const exists = tasks.some(
        (x) => x.assetId === a.id && x.name.split(' ')[0].toLowerCase() === t.name.split(' ')[0].toLowerCase(),
      );
      if (!exists) tasks.push({ ...t, id: newId() });
    });
  });
  return {
    version: 2,
    fleets: [
      {
        id: fleetId,
        name: 'My Fleet',
        kind: 'work',
        memberIds: technicians.map((t) => t.id),
        staleHoursDays: 7,
        ...DEFAULT_THRESHOLDS,
      },
    ],
    technicians,
    assets: oldAssets.map((a) => ({ ...a, fleetId, specs: { ...a.specs, filters: a.specs?.filters ?? [] } })),
    tasks,
    logs: oldLogs,
    assignments: [],
    prefs: { theme: 'system', accent: 'amber', activeFleetId: fleetId },
  };
}

/** Schedule for a newly added machine: its factory template, or the default 10-hour items. */
function startingTasks(assetId: string, currentHours: number, templateId?: string): ServiceTask[] {
  const t = findTemplate(templateId);
  const items = t
    ? t.items.map((i) => scheduleFromTemplate(i, currentHours))
    : defaultRoutineTasks(assetId, currentHours);
  return items.map((i) => ({ ...i, assetId, id: newId() }));
}

// ---------- Provider ----------

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => buildSeedData());
  const [ready, setReady] = useState(false);
  const [currentAssetId, setCurrentAssetId] = useState<string | undefined>();
  // Latest data for validations inside callbacks without re-creating them.
  const ref = useRef(data);
  ref.current = data;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setData(raw ? upgrade(JSON.parse(raw)) : buildSeedData());
      } catch {
        setData(buildSeedData());
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

  // ----- Hours and service logs -----

  const updateHours = useCallback((assetId: string, hours: number): Result => {
    const asset = ref.current.assets.find((a) => a.id === assetId);
    if (!asset) return 'Machine not found.';
    if (!Number.isFinite(hours) || hours < 0) return 'Enter a valid number of hours.';
    if (hours < asset.currentHours) {
      return `Hours cannot be lower than the current reading (${asset.currentHours}). To correct a typo, edit the machine in Settings.`;
    }
    update((d) => ({
      ...d,
      assets: d.assets.map((a) =>
        a.id === assetId ? { ...a, currentHours: hours, hoursUpdatedAt: new Date().toISOString() } : a,
      ),
    }));
    return null;
  }, [update]);

  const addServiceLog = useCallback((entry: NewServiceLog): Result => {
    const asset = ref.current.assets.find((a) => a.id === entry.assetId);
    if (!asset) return 'Select a machine first.';
    if (!entry.performedBy.trim()) return 'Enter who did the service.';
    if (!entry.taskName.trim()) return 'Enter what service was done.';
    if (!Number.isFinite(entry.hoursAtService) || entry.hoursAtService < 0) {
      return 'Enter the hours at the time of service.';
    }
    if (Number.isNaN(new Date(entry.date).getTime())) return 'Enter a valid date.';

    const log: ServiceLog = { ...entry, id: newId() };
    const completed = new Set(entry.completedTaskIds ?? []);
    const newest = entry.hoursAtService >= asset.currentHours;
    update((d) => ({
      ...d,
      logs: [log, ...d.logs],
      tasks: d.tasks.map((t) =>
        completed.has(t.id) ? { ...t, lastDoneHours: entry.hoursAtService, lastDoneDate: entry.date } : t,
      ),
      assets: d.assets.map((a) =>
        a.id === entry.assetId && newest
          ? { ...a, currentHours: entry.hoursAtService, hoursUpdatedAt: new Date().toISOString() }
          : a,
      ),
    }));
    return null;
  }, [update]);

  const updateSpecs = useCallback((assetId: string, specs: AssetSpecs) => {
    update((d) => ({ ...d, assets: d.assets.map((a) => (a.id === assetId ? { ...a, specs } : a)) }));
  }, [update]);

  // ----- Machines and schedules -----

  const saveAsset = useCallback((input: Omit<Asset, 'id'> & { id?: string }) => {
    if (!input.name.trim()) return { error: 'Enter a machine name.' };
    if (!input.fleetId) return { error: 'Choose a fleet.' };
    const code = input.barcode?.trim().toLowerCase();
    const serial = input.serial.trim().toLowerCase();
    const clash = ref.current.assets.find(
      (a) =>
        a.id !== input.id &&
        ((code && a.barcode?.toLowerCase() === code) || (serial && a.serial.toLowerCase() === serial)),
    );
    if (clash) return { error: `That barcode or serial number is already used by ${clash.name}.` };

    const id = input.id ?? newId();
    const asset: Asset = {
      ...input,
      id,
      name: input.name.trim(),
      serial: input.serial.trim(),
      barcode: input.barcode?.trim() || undefined,
    };
    const isNew = !ref.current.assets.some((a) => a.id === id);
    update((d) => ({
      ...d,
      assets: isNew ? [...d.assets, asset] : d.assets.map((a) => (a.id === id ? asset : a)),
      // New machines start with their factory schedule, or the three 10-hour routine items.
      tasks: isNew ? [...d.tasks, ...startingTasks(id, asset.currentHours, asset.templateId)] : d.tasks,
    }));
    return { error: null, id };
  }, [update]);

  const applyTemplate = useCallback((assetId: string, templateId: string) => {
    update((d) => {
      const asset = d.assets.find((a) => a.id === assetId);
      if (!asset) return d;
      return {
        ...d,
        assets: d.assets.map((a) => (a.id === assetId ? { ...a, templateId } : a)),
        tasks: [...d.tasks.filter((t) => t.assetId !== assetId), ...startingTasks(assetId, asset.currentHours, templateId)],
      };
    });
  }, [update]);

  const quickAdd = useCallback((fleetId: string, counts: Record<string, number>) => {
    const newAssets: Asset[] = [];
    const newTasks: ServiceTask[] = [];
    const existingNames = new Set(ref.current.assets.map((a) => a.name));
    Object.entries(counts).forEach(([templateId, count]) => {
      const t = findTemplate(templateId);
      if (!t) return;
      let n = 1;
      for (let i = 0; i < count; i++) {
        let name = `${templateLabel(t)} #${n}`;
        while (existingNames.has(name)) name = `${templateLabel(t)} #${++n}`;
        existingNames.add(name);
        const id = newId();
        newAssets.push({
          id,
          fleetId,
          name,
          make: t.make,
          model: t.model,
          templateId,
          serial: '',
          currentHours: 0,
          hoursUpdatedAt: new Date().toISOString(),
          specs: { filters: [] },
        });
        newTasks.push(...startingTasks(id, 0, templateId));
      }
    });
    if (newAssets.length) update((d) => ({ ...d, assets: [...d.assets, ...newAssets], tasks: [...d.tasks, ...newTasks] }));
    return newAssets.length;
  }, [update]);

  const deleteAsset = useCallback((id: string) => {
    update((d) => ({
      ...d,
      assets: d.assets.filter((a) => a.id !== id),
      tasks: d.tasks.filter((t) => t.assetId !== id),
      logs: d.logs.filter((l) => l.assetId !== id),
      assignments: d.assignments.filter((x) => x.assetId !== id),
    }));
  }, [update]);

  const saveTask = useCallback((input: Omit<ServiceTask, 'id'> & { id?: string }): Result => {
    if (!input.name.trim()) return 'Enter a name for the service item.';
    if (!input.intervalHours && !input.intervalDays) return 'Set an interval in hours, days, or both.';
    const task: ServiceTask = { ...input, id: input.id ?? newId(), name: input.name.trim() };
    update((d) => ({
      ...d,
      tasks: d.tasks.some((t) => t.id === task.id)
        ? d.tasks.map((t) => (t.id === task.id ? task : t))
        : [...d.tasks, task],
    }));
    return null;
  }, [update]);

  const deleteTask = useCallback((id: string) => {
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, [update]);

  // ----- Fleets and technicians -----

  const saveFleet = useCallback((input: Omit<Fleet, 'id'> & { id?: string }) => {
    if (!input.name.trim()) return { error: 'Enter a fleet name.' };
    const id = input.id ?? newId();
    const fleet: Fleet = { ...input, id, name: input.name.trim() };
    update((d) => ({
      ...d,
      fleets: d.fleets.some((f) => f.id === id) ? d.fleets.map((f) => (f.id === id ? fleet : f)) : [...d.fleets, fleet],
    }));
    return { error: null, id };
  }, [update]);

  const deleteFleet = useCallback((id: string): Result => {
    const d = ref.current;
    if (d.fleets.length <= 1) return 'You need at least one fleet.';
    if (d.assets.some((a) => a.fleetId === id)) return 'Move or delete this fleet’s machines first.';
    update((x) => {
      const fleets = x.fleets.filter((f) => f.id !== id);
      return {
        ...x,
        fleets,
        prefs: x.prefs.activeFleetId === id ? { ...x.prefs, activeFleetId: fleets[0].id } : x.prefs,
      };
    });
    return null;
  }, [update]);

  const saveTechnician = useCallback((input: Omit<Technician, 'id'> & { id?: string }) => {
    if (!input.name.trim()) return { error: 'Enter a name.' };
    const id = input.id ?? newId();
    const tech: Technician = { ...input, id, name: input.name.trim() };
    update((d) => ({
      ...d,
      technicians: d.technicians.some((t) => t.id === id)
        ? d.technicians.map((t) => (t.id === id ? tech : t))
        : [...d.technicians, tech],
    }));
    return { error: null, id };
  }, [update]);

  const deleteTechnician = useCallback((id: string) => {
    update((d) => ({
      ...d,
      technicians: d.technicians.filter((t) => t.id !== id),
      fleets: d.fleets.map((f) => ({ ...f, memberIds: f.memberIds.filter((m) => m !== id) })),
      assignments: d.assignments.map((a) => (a.technicianId === id ? { ...a, technicianId: undefined } : a)),
      prefs: d.prefs.meTechnicianId === id ? { ...d.prefs, meTechnicianId: undefined } : d.prefs,
    }));
  }, [update]);

  // ----- Assignments -----

  const saveAssignment = useCallback((input: Omit<Assignment, 'id'> & { id?: string }): Result => {
    const items = input.items.filter((i) => i.text.trim());
    if (!items.length && !input.notes?.trim()) return 'Add at least one task or a note.';
    const a: Assignment = { ...input, items, id: input.id ?? newId() };
    update((d) => ({
      ...d,
      assignments: d.assignments.some((x) => x.id === a.id)
        ? d.assignments.map((x) => (x.id === a.id ? a : x))
        : [a, ...d.assignments],
    }));
    return null;
  }, [update]);

  const toggleChecklistItem = useCallback((assignmentId: string, itemId: string) => {
    update((d) => ({
      ...d,
      assignments: d.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, items: a.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : a,
      ),
    }));
  }, [update]);

  const setAssignmentStatus = useCallback((assignmentId: string, status: Assignment['status']) => {
    update((d) => ({
      ...d,
      assignments: d.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, status, completedAt: status === 'done' ? new Date().toISOString() : undefined }
          : a,
      ),
    }));
  }, [update]);

  const deleteAssignment = useCallback((id: string) => {
    update((d) => ({ ...d, assignments: d.assignments.filter((a) => a.id !== id) }));
  }, [update]);

  // ----- Preferences -----

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    update((d) => ({ ...d, prefs: { ...d.prefs, ...patch } }));
  }, [update]);

  const resetDemoData = useCallback(() => setData(buildSeedData()), []);

  const value = useMemo<StoreValue>(() => {
    const activeFleet = data.fleets.find((f) => f.id === data.prefs.activeFleetId) ?? data.fleets[0];
    const techName = (id?: string) =>
      (id && data.technicians.find((t) => t.id === id)?.name) || 'Unassigned';
    return {
      ...data,
      ready,
      activeFleet,
      fleetAssets: data.assets.filter((a) => a.fleetId === activeFleet.id),
      thresholds: {
        orangeOverdueHours: activeFleet.orangeOverdueHours,
        majorWarnHours: activeFleet.majorWarnHours,
      },
      currentAssetId,
      setCurrentAssetId,
      updateHours,
      addServiceLog,
      updateSpecs,
      saveAsset,
      deleteAsset,
      applyTemplate,
      quickAdd,
      saveTask,
      deleteTask,
      saveFleet,
      deleteFleet,
      saveTechnician,
      deleteTechnician,
      saveAssignment,
      toggleChecklistItem,
      setAssignmentStatus,
      deleteAssignment,
      setPrefs,
      technicianName: techName,
      resetDemoData,
    };
  }, [
    data, ready, currentAssetId, updateHours, addServiceLog, updateSpecs, saveAsset, deleteAsset, applyTemplate, quickAdd,
    saveTask, deleteTask, saveFleet, deleteFleet, saveTechnician, deleteTechnician, saveAssignment,
    toggleChecklistItem, setAssignmentStatus, deleteAssignment, setPrefs, resetDemoData,
  ]);

  return (
    <StoreContext.Provider value={value}>
      <ThemeProvider mode={data.prefs.theme} accent={data.prefs.accent}>
        {children}
      </ThemeProvider>
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
