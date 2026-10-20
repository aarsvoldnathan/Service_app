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
import { DEFAULT_CATEGORIES, defaultTasksForCategory, LEGACY_SPEC_KEYS } from './categories';
import { buildSeedData, defaultRoutineTasks } from './seedData';
import { findTemplate, scheduleFromTemplate, templateLabel } from './templates';
import { ThemeProvider } from './theme';
import {
  AppData,
  Asset,
  AssetSpecs,
  Assignment,
  Category,
  Expense,
  Fleet,
  Job,
  NewServiceLog,
  Preferences,
  ServiceLog,
  ServiceTask,
  ShoppingItem,
  Technician,
  TimeEntry,
} from './types';

/** Data saved on this phone before accounts existed. */
export const LEGACY_STORAGE_KEY = 'service-ceo:v1';
export const userStorageKey = (userId: string) => `service-ceo:user:${userId}`;

/** A brand-new account starts with no fleets until it uploads, joins or creates one. */
export function emptyData(): AppData {
  return {
    version: 3,
    categories: DEFAULT_CATEGORIES,
    shopping: [],
    jobs: [],
    timeEntries: [],
    expenses: [],
    fleets: [],
    technicians: [],
    assets: [],
    tasks: [],
    logs: [],
    assignments: [],
    prefs: { theme: 'system', accent: 'amber', activeFleetId: '', business: { nextInvoiceNumber: 1001 } },
  };
}

/** Read the pre-account data on this phone (or null if there is none). */
export async function loadLegacyData(): Promise<AppData | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? upgrade(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const PLACEHOLDER_FLEET: Fleet = {
  id: '',
  name: 'No fleet',
  kind: 'work',
  memberIds: [],
  staleHoursDays: 7,
  orangeOverdueHours: 10,
  majorWarnHours: 10,
};

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type Result = string | null; // error message, or null on success

export type ServiceExtras = {
  /** Parts to add to the shopping list. */
  shopping?: { name: string; partNumber?: string; quantity?: string }[];
  /** Custom parts to save to the machine's parts list. */
  saveParts?: { label: string; partNumber: string }[];
};

export type FleetBundle = {
  kind: 'service-ceo-fleet';
  version: 3;
  exportedAt: string;
  fleet: Fleet;
  technicians: Technician[];
  categories: Category[];
  assets: Asset[];
  tasks: ServiceTask[];
  logs: ServiceLog[];
  assignments: Assignment[];
  shopping: ShoppingItem[];
};

type StoreValue = AppData & {
  ready: boolean;
  /** The whole data set (for syncing). */
  data: AppData;
  /** Replace data (used by the online sync). */
  replaceData: (fn: (d: AppData) => AppData) => void;
  activeFleet: Fleet;
  /** Machines in the active fleet. */
  fleetAssets: Asset[];
  thresholds: Thresholds;
  /** Machine currently open on the service screen (shared with the find screen). */
  currentAssetId?: string;
  setCurrentAssetId: (id: string | undefined) => void;

  updateHours: (assetId: string, hours: number) => Result;
  /** Log a service. Parts can also go to the shopping list and/or be saved to the machine. */
  addServiceLog: (entry: NewServiceLog, extras?: ServiceExtras) => Result;
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

  saveCategory: (c: Omit<Category, 'id'> & { id?: string }) => Result;
  deleteCategory: (id: string) => Result;
  categoryOf: (asset?: Asset) => Category;

  saveShoppingItem: (i: Omit<ShoppingItem, 'id' | 'createdAt' | 'purchased'> & Partial<ShoppingItem>) => Result;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  clearPurchased: (fleetId: string) => void;

  saveJob: (j: Omit<Job, 'id' | 'createdAt' | 'status'> & Partial<Job>) => { error: Result; id?: string };
  deleteJob: (id: string) => void;
  /** Give the job the next invoice number and mark it sent. */
  markInvoiced: (jobId: string) => number;
  markPaid: (jobId: string, checkNumber: string) => Result;
  reopenJob: (jobId: string) => void;
  saveTimeEntry: (e: Omit<TimeEntry, 'id'> & { id?: string }) => Result;
  /** Start the time clock on a job (stops any other clock this person has running). */
  clockIn: (jobId: string) => void;
  /** Stop the clock and save the time as an entry. Returns the hours saved. */
  clockOut: (jobId: string, note?: string) => number;
  deleteTimeEntry: (id: string) => void;
  saveExpense: (e: Omit<Expense, 'id'> & { id?: string }) => Result;
  deleteExpense: (id: string) => void;

  /** Everything about one fleet, to send to another phone. */
  exportFleet: (fleetId: string) => FleetBundle;
  /** Merge a fleet received from another phone. Returns a summary or an error. */
  importFleet: (bundle: unknown) => { error: Result; summary?: string };

  setPrefs: (patch: Partial<Preferences>) => void;
  technicianName: (id?: string) => string;
  resetDemoData: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

// ---------- Loading and upgrading saved data ----------

const DEMO_IDS = new Set(['a1', 'a2', 'a3']);
const isSampleSpecs = (s?: any) =>
  !!s &&
  [s.lugNutTorque, s.tirePressure, s.oilCapacity, s.oilType, ...(s.filters ?? []).map((f: any) => f.partNumber)]
    .filter(Boolean)
    .some((v) => /sample/i.test(v as string));

const guessKind = (name: string): ServiceTask['kind'] =>
  /grease|check|clean|inspect|wash/i.test(name) ? 'routine' : 'major';

type AppDataV2 = Omit<AppData, 'version' | 'categories' | 'shopping' | 'jobs' | 'timeEntries' | 'expenses'> & {
  version: 2;
};

/** Specs from builds before categories: fixed fields -> values map. */
function toSpecs(old: any): AssetSpecs {
  if (old?.values) return { values: { ...old.values }, filters: old.filters ?? [] };
  const values: Record<string, string> = {};
  LEGACY_SPEC_KEYS.forEach((k) => {
    if (old?.[k]) values[k] = String(old[k]);
  });
  return { values, filters: old?.filters ?? [] };
}

/** Turn whatever is in storage (any older format) into the current format. */
function upgrade(raw: any): AppData {
  if (raw?.version === 3) {
    const seed = buildSeedData();
    const d = raw as AppData;
    // An account with no fleets yet stays empty (no demo data mixed into online fleets).
    const fleets = d.fleets ?? [];
    return {
      ...d,
      fleets,
      categories: d.categories?.length ? d.categories : DEFAULT_CATEGORIES,
      assets: (d.assets ?? []).map((a) => ({ ...a, category: a.category ?? 'other', specs: toSpecs(a.specs) })),
      shopping: d.shopping ?? [],
      jobs: d.jobs ?? [],
      timeEntries: d.timeEntries ?? [],
      expenses: d.expenses ?? [],
      prefs: {
        ...seed.prefs,
        ...d.prefs,
        business: { ...seed.prefs.business, name: undefined, ...d.prefs?.business },
        activeFleetId: fleets.some((f) => f.id === d.prefs?.activeFleetId) ? d.prefs.activeFleetId : fleets[0]?.id ?? '',
      },
    };
  }
  const v2 = upgradeToV2(raw);
  const seed = buildSeedData();
  const categoryFor = (a: Asset) => findTemplate(a.templateId)?.category ?? 'other';
  return {
    ...v2,
    version: 3,
    categories: DEFAULT_CATEGORIES,
    assets: v2.assets.map((a) => ({ ...a, category: (a as any).category ?? categoryFor(a), specs: toSpecs(a.specs) })),
    shopping: [],
    jobs: [],
    timeEntries: [],
    expenses: [],
    prefs: { ...v2.prefs, business: { nextInvoiceNumber: seed.prefs.business.nextInvoiceNumber } },
  };
}

function upgradeToV2(raw: any): AppDataV2 {
  if (raw?.version === 2) {
    const seed = buildSeedData();
    const data = raw as AppDataV2;
    const fleets = data.fleets?.length ? data.fleets : seed.fleets;
    return {
      version: 2,
      fleets,
      technicians: data.technicians ?? [],
      assets: data.assets ?? [],
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
        specs: old.specs && !isSampleSpecs(old.specs) ? toSpecs(old.specs) : a.specs,
      };
    });
    return { ...seed, version: 2 };
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
    assets: oldAssets.map((a) => ({ ...a, fleetId, category: 'other', specs: toSpecs(a.specs) })),
    tasks,
    logs: oldLogs,
    assignments: [],
    prefs: { theme: 'system', accent: 'amber', activeFleetId: fleetId, business: { nextInvoiceNumber: 1001 } },
  };
}

/** Schedule for a newly added machine: its factory template, or the default 10-hour items. */
function startingTasks(assetId: string, currentHours: number, templateId?: string, category?: string): ServiceTask[] {
  const t = findTemplate(templateId);
  const items = t
    ? t.items.map((i) => scheduleFromTemplate(i, currentHours))
    : defaultTasksForCategory(category, currentHours);
  return items.map((i) => ({ ...i, assetId, id: newId() }));
}

// ---------- Provider ----------

export function StoreProvider({ children, storageKey }: { children: React.ReactNode; storageKey: string }) {
  const [data, setData] = useState<AppData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [currentAssetId, setCurrentAssetId] = useState<string | undefined>();
  // Latest data for validations inside callbacks without re-creating them.
  const ref = useRef(data);
  ref.current = data;

  // Each account has its own saved copy on the phone.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    setReady(false);
    loadedKey.current = null;
    (async () => {
      let next: AppData;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        next = raw ? upgrade(JSON.parse(raw)) : emptyData();
      } catch {
        next = emptyData();
      }
      if (!alive) return;
      setData(next);
      loadedKey.current = storageKey;
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready || loadedKey.current !== storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(data)).catch(() => {});
  }, [data, ready, storageKey]);

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

  const addServiceLog = useCallback((entry: NewServiceLog, extras?: ServiceExtras): Result => {
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
      assets: d.assets.map((a) => {
        if (a.id !== entry.assetId) return a;
        let next = a;
        if (newest) next = { ...next, currentHours: entry.hoursAtService, hoursUpdatedAt: new Date().toISOString() };
        const toSave = (extras?.saveParts ?? []).filter(
          (p) => !next.specs.filters.some((f) => f.label === p.label && f.partNumber === p.partNumber),
        );
        if (toSave.length) next = { ...next, specs: { ...next.specs, filters: [...next.specs.filters, ...toSave] } };
        return next;
      }),
      shopping: [
        ...(extras?.shopping ?? []).map((p) => ({
          id: newId(),
          fleetId: asset.fleetId,
          name: p.name,
          partNumber: p.partNumber,
          quantity: p.quantity,
          assetId: asset.id,
          addedBy: entry.performedBy,
          createdAt: new Date().toISOString(),
          purchased: false,
        })),
        ...d.shopping,
      ],
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
      tasks: isNew ? [...d.tasks, ...startingTasks(id, asset.currentHours, asset.templateId, asset.category)] : d.tasks,
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
        tasks: [...d.tasks.filter((t) => t.assetId !== assetId), ...startingTasks(assetId, asset.currentHours, templateId, asset.category)],
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
          category: t.category,
          serial: '',
          currentHours: 0,
          hoursUpdatedAt: new Date().toISOString(),
          specs: { values: {}, filters: [] },
        });
        newTasks.push(...startingTasks(id, 0, templateId, t.category));
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

  // ----- Categories -----

  const saveCategory = useCallback((input: Omit<Category, 'id'> & { id?: string }): Result => {
    if (!input.name.trim()) return 'Enter a category name.';
    const c: Category = {
      ...input,
      id: input.id ?? newId(),
      name: input.name.trim(),
      fields: input.fields.filter((f) => f.label.trim()).map((f) => ({ ...f, label: f.label.trim() })),
    };
    update((d) => ({
      ...d,
      categories: d.categories.some((x) => x.id === c.id) ? d.categories.map((x) => (x.id === c.id ? c : x)) : [...d.categories, c],
    }));
    return null;
  }, [update]);

  const deleteCategory = useCallback((id: string): Result => {
    if (id === 'other') return 'The "Other" category is used as a fallback and cannot be deleted.';
    const n = ref.current.assets.filter((a) => a.category === id).length;
    if (n) return `${n} machine${n === 1 ? ' uses' : 's use'} this category. Change them first.`;
    update((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id) }));
    return null;
  }, [update]);

  // ----- Shopping list -----

  const saveShoppingItem = useCallback(
    (input: Omit<ShoppingItem, 'id' | 'createdAt' | 'purchased'> & Partial<ShoppingItem>): Result => {
      if (!input.name.trim() && !input.partNumber?.trim()) return 'Enter a part name or number.';
      const item: ShoppingItem = {
        createdAt: new Date().toISOString(),
        purchased: false,
        ...input,
        id: input.id ?? newId(),
        name: input.name.trim() || (input.partNumber ?? '').trim(),
      };
      update((d) => ({
        ...d,
        shopping: d.shopping.some((x) => x.id === item.id) ? d.shopping.map((x) => (x.id === item.id ? item : x)) : [item, ...d.shopping],
      }));
      return null;
    },
    [update],
  );

  const toggleShoppingItem = useCallback((id: string) => {
    update((d) => ({
      ...d,
      shopping: d.shopping.map((x) =>
        x.id === id ? { ...x, purchased: !x.purchased, purchasedAt: x.purchased ? undefined : new Date().toISOString() } : x,
      ),
    }));
  }, [update]);

  const deleteShoppingItem = useCallback((id: string) => {
    update((d) => ({ ...d, shopping: d.shopping.filter((x) => x.id !== id) }));
  }, [update]);

  const clearPurchased = useCallback((fleetId: string) => {
    update((d) => ({ ...d, shopping: d.shopping.filter((x) => !(x.fleetId === fleetId && x.purchased)) }));
  }, [update]);

  // ----- Jobs, time and expenses -----

  const saveJob = useCallback((input: Omit<Job, 'id' | 'createdAt' | 'status'> & Partial<Job>) => {
    if (!input.title.trim()) return { error: 'Enter a job name.' };
    if (!Number.isFinite(input.rate) || input.rate < 0) return { error: 'Enter a valid hourly rate.' };
    const job: Job = {
      createdAt: new Date().toISOString(),
      status: 'open',
      fleetId: ref.current.prefs.activeFleetId || undefined,
      ...input,
      id: input.id ?? newId(),
      title: input.title.trim(),
    };
    update((d) => ({
      ...d,
      jobs: d.jobs.some((x) => x.id === job.id) ? d.jobs.map((x) => (x.id === job.id ? job : x)) : [job, ...d.jobs],
    }));
    return { error: null, id: job.id };
  }, [update]);

  const deleteJob = useCallback((id: string) => {
    update((d) => ({
      ...d,
      jobs: d.jobs.filter((j) => j.id !== id),
      timeEntries: d.timeEntries.filter((t) => t.jobId !== id),
      expenses: d.expenses.filter((e) => e.jobId !== id),
    }));
  }, [update]);

  const markInvoiced = useCallback((jobId: string) => {
    const job = ref.current.jobs.find((j) => j.id === jobId);
    const number = job?.invoiceNumber ?? ref.current.prefs.business.nextInvoiceNumber;
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) =>
        j.id === jobId
          ? { ...j, invoiceNumber: number, status: j.status === 'paid' ? 'paid' : 'invoiced', invoicedAt: j.invoicedAt ?? new Date().toISOString() }
          : j,
      ),
      prefs: job?.invoiceNumber ? d.prefs : { ...d.prefs, business: { ...d.prefs.business, nextInvoiceNumber: number + 1 } },
    }));
    return number;
  }, [update]);

  const markPaid = useCallback((jobId: string, checkNumber: string): Result => {
    if (!checkNumber.trim()) return 'Enter the check number (or "cash", "card", etc.).';
    const job = ref.current.jobs.find((j) => j.id === jobId);
    const number = job?.invoiceNumber ?? ref.current.prefs.business.nextInvoiceNumber;
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) =>
        j.id === jobId
          ? { ...j, status: 'paid', checkNumber: checkNumber.trim(), paidAt: new Date().toISOString(), invoiceNumber: number, invoicedAt: j.invoicedAt ?? new Date().toISOString() }
          : j,
      ),
      prefs: job?.invoiceNumber ? d.prefs : { ...d.prefs, business: { ...d.prefs.business, nextInvoiceNumber: number + 1 } },
    }));
    return null;
  }, [update]);

  const reopenJob = useCallback((jobId: string) => {
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, status: 'open', paidAt: undefined, checkNumber: undefined } : j)),
    }));
  }, [update]);

  const saveTimeEntry = useCallback((input: Omit<TimeEntry, 'id'> & { id?: string }): Result => {
    if (!Number.isFinite(input.hours) || input.hours <= 0 || input.hours > 24) return 'Enter hours between 0 and 24.';
    if (Number.isNaN(new Date(input.date).getTime())) return 'Enter a valid date.';
    const e: TimeEntry = { ...input, id: input.id ?? newId() };
    update((d) => ({
      ...d,
      timeEntries: d.timeEntries.some((x) => x.id === e.id) ? d.timeEntries.map((x) => (x.id === e.id ? e : x)) : [...d.timeEntries, e],
    }));
    return null;
  }, [update]);

  const clockOut = useCallback((jobId: string, note?: string) => {
    const job = ref.current.jobs.find((j) => j.id === jobId);
    if (!job?.clockStartedAt) return 0;
    const start = new Date(job.clockStartedAt);
    const hours = Math.round(((Date.now() - start.getTime()) / 3600000) * 100) / 100;
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, clockStartedAt: undefined } : j)),
      // Under a minute is not worth a line on the invoice.
      timeEntries:
        hours >= 0.02
          ? [...d.timeEntries, { id: newId(), jobId, technicianId: job.technicianId, date: start.toISOString(), hours, note: note?.trim() || undefined }]
          : d.timeEntries,
    }));
    return hours >= 0.02 ? hours : 0;
  }, [update]);

  const clockIn = useCallback((jobId: string) => {
    const job = ref.current.jobs.find((j) => j.id === jobId);
    if (!job || job.clockStartedAt) return;
    // One clock per person: stop the others first.
    ref.current.jobs
      .filter((j) => j.id !== jobId && j.clockStartedAt && j.technicianId === job.technicianId)
      .forEach((j) => clockOut(j.id));
    const now = new Date().toISOString();
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, clockStartedAt: now } : j)),
    }));
  }, [update, clockOut]);

  const deleteTimeEntry = useCallback((id: string) => {
    update((d) => ({ ...d, timeEntries: d.timeEntries.filter((x) => x.id !== id) }));
  }, [update]);

  const saveExpense = useCallback((input: Omit<Expense, 'id'> & { id?: string }): Result => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter the amount.';
    if (!input.description.trim()) return 'Describe the expense.';
    if (Number.isNaN(new Date(input.date).getTime())) return 'Enter a valid date.';
    const e: Expense = { ...input, id: input.id ?? newId(), description: input.description.trim() };
    update((d) => ({
      ...d,
      expenses: d.expenses.some((x) => x.id === e.id) ? d.expenses.map((x) => (x.id === e.id ? e : x)) : [...d.expenses, e],
    }));
    return null;
  }, [update]);

  const deleteExpense = useCallback((id: string) => {
    update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }));
  }, [update]);

  // ----- Sharing a fleet between phones -----

  const exportFleet = useCallback((fleetId: string): FleetBundle => {
    const d = ref.current;
    const fleet = d.fleets.find((f) => f.id === fleetId) ?? d.fleets[0];
    const assets = d.assets.filter((a) => a.fleetId === fleet.id);
    const ids = new Set(assets.map((a) => a.id));
    const usedCats = new Set(assets.map((a) => a.category));
    return {
      kind: 'service-ceo-fleet',
      version: 3,
      exportedAt: new Date().toISOString(),
      fleet,
      // Wages stay private: hourly rates are never put in a fleet file.
      technicians: d.technicians.filter((t) => fleet.memberIds.includes(t.id)).map(({ hourlyRate: _rate, ...t }) => t),
      categories: d.categories.filter((c) => usedCats.has(c.id)),
      assets,
      tasks: d.tasks.filter((t) => ids.has(t.assetId)),
      logs: d.logs.filter((l) => ids.has(l.assetId)),
      assignments: d.assignments.filter((a) => ids.has(a.assetId)),
      shopping: d.shopping.filter((s) => s.fleetId === fleet.id),
    };
  }, []);

  const importFleet = useCallback((raw: unknown) => {
    const b = raw as FleetBundle;
    if (!b || b.kind !== 'service-ceo-fleet' || !b.fleet || !Array.isArray(b.assets)) {
      return { error: 'This file is not a Service Ceo fleet.' };
    }
    const merge = <T extends { id: string }>(mine: T[], theirs: T[] = []) => {
      const byId = new Map(mine.map((x) => [x.id, x]));
      theirs.forEach((x) => byId.set(x.id, x));
      return Array.from(byId.values());
    };
    const assets = b.assets.map((a) => ({ ...a, category: a.category ?? 'other', specs: toSpecs(a.specs) }));
    update((d) => ({
      ...d,
      fleets: merge(d.fleets, [b.fleet]),
      technicians: merge(
        d.technicians,
        (b.technicians ?? []).map((t) => ({ ...t, hourlyRate: d.technicians.find((x) => x.id === t.id)?.hourlyRate })),
      ),
      categories: merge(d.categories, b.categories),
      assets: merge(d.assets, assets),
      tasks: merge(d.tasks, b.tasks),
      logs: merge(d.logs, b.logs),
      assignments: merge(d.assignments, b.assignments),
      shopping: merge(d.shopping, b.shopping),
      prefs: { ...d.prefs, activeFleetId: b.fleet.id },
    }));
    return {
      error: null,
      summary: `${b.fleet.name}: ${assets.length} machines, ${(b.technicians ?? []).length} crew members, ${(b.logs ?? []).length} service records.`,
    };
  }, [update]);

  // ----- Preferences -----

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    update((d) => ({ ...d, prefs: { ...d.prefs, ...patch } }));
  }, [update]);

  const resetDemoData = useCallback(() => setData(buildSeedData()), []);

  const value = useMemo<StoreValue>(() => {
    const activeFleet = data.fleets.find((f) => f.id === data.prefs.activeFleetId) ?? data.fleets[0] ?? PLACEHOLDER_FLEET;
    const techName = (id?: string) =>
      (id && data.technicians.find((t) => t.id === id)?.name) || 'Unassigned';
    return {
      ...data,
      data,
      replaceData: update,
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
      saveCategory,
      deleteCategory,
      categoryOf: (asset?: Asset) =>
        data.categories.find((c) => c.id === asset?.category) ??
        data.categories.find((c) => c.id === 'other') ??
        DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1],
      saveShoppingItem,
      toggleShoppingItem,
      deleteShoppingItem,
      clearPurchased,
      saveJob,
      deleteJob,
      markInvoiced,
      markPaid,
      reopenJob,
      saveTimeEntry,
      clockIn,
      clockOut,
      deleteTimeEntry,
      saveExpense,
      deleteExpense,
      exportFleet,
      importFleet,
      setPrefs,
      technicianName: techName,
      resetDemoData,
    };
  }, [
    data, update, ready, currentAssetId, updateHours, addServiceLog, updateSpecs, saveAsset, deleteAsset, applyTemplate, quickAdd,
    saveTask, deleteTask, saveFleet, deleteFleet, saveTechnician, deleteTechnician, saveAssignment,
    toggleChecklistItem, setAssignmentStatus, deleteAssignment, setPrefs, resetDemoData,
    saveCategory, deleteCategory, saveShoppingItem, toggleShoppingItem, deleteShoppingItem, clearPurchased,
    saveJob, deleteJob, markInvoiced, markPaid, reopenJob, saveTimeEntry, clockIn, clockOut, deleteTimeEntry, saveExpense, deleteExpense,
    exportFleet, importFleet,
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
