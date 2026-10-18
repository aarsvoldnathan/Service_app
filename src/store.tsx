import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { buildSeedData } from './seedData';
import { Asset, AssetSpecs, NewServiceLog, ServiceLog, ServiceTask } from './types';

const STORAGE_KEY = 'service-ceo:v1';

type Data = { assets: Asset[]; tasks: ServiceTask[]; logs: ServiceLog[] };

type StoreValue = Data & {
  ready: boolean;
  /** Returns an error message, or null on success. */
  updateHours: (assetId: string, hours: number) => string | null;
  /** Returns an error message, or null on success. */
  addServiceLog: (entry: NewServiceLog) => string | null;
  updateSpecs: (assetId: string, specs: AssetSpecs) => void;
  resetDemoData: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Fill in fields added in later versions so data saved by older builds still loads. */
function normalize(raw: Partial<Data>): Data {
  const assets = (raw.assets ?? []).map((a) => ({
    ...a,
    specs: { ...a.specs, filters: a.specs?.filters ?? [] },
  }));
  return { assets, tasks: raw.tasks ?? [], logs: raw.logs ?? [] };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>({ assets: [], tasks: [], logs: [] });
  const [ready, setReady] = useState(false);

  // Load saved data once; seed demo data on the very first launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setData(raw ? normalize(JSON.parse(raw) as Partial<Data>) : buildSeedData());
      } catch {
        setData(buildSeedData());
      }
      setReady(true);
    })();
  }, []);

  // Save whenever data changes (after the initial load).
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  const updateHours = useCallback(
    (assetId: string, hours: number): string | null => {
      const asset = data.assets.find((a) => a.id === assetId);
      if (!asset) return 'Equipment not found.';
      if (!Number.isFinite(hours) || hours < 0) return 'Enter a valid number of hours.';
      if (hours < asset.currentHours) {
        return `Hours cannot be lower than the current reading (${asset.currentHours}).`;
      }
      setData((d) => ({
        ...d,
        assets: d.assets.map((a) =>
          a.id === assetId
            ? { ...a, currentHours: hours, hoursUpdatedAt: new Date().toISOString() }
            : a,
        ),
      }));
      return null;
    },
    [data.assets],
  );

  const addServiceLog = useCallback(
    (entry: NewServiceLog): string | null => {
      const asset = data.assets.find((a) => a.id === entry.assetId);
      if (!asset) return 'Select a vehicle first.';
      if (!entry.performedBy.trim()) return 'Enter who did the service.';
      if (!entry.taskName.trim()) return 'Enter what service was done.';
      if (!Number.isFinite(entry.hoursAtService) || entry.hoursAtService < 0) {
        return 'Enter the hours at the time of service.';
      }
      if (Number.isNaN(new Date(entry.date).getTime())) return 'Enter a valid date.';

      const log: ServiceLog = { ...entry, id: newId() };
      const completed = new Set(entry.completedTaskIds ?? []);
      const isNewestReading = entry.hoursAtService >= asset.currentHours;

      setData((d) => ({
        logs: [log, ...d.logs],
        // Completed scheduled services restart their interval from this service.
        tasks: d.tasks.map((t) =>
          completed.has(t.id)
            ? { ...t, lastDoneHours: entry.hoursAtService, lastDoneDate: entry.date }
            : t,
        ),
        // A service reading higher than the last known hours is also an hours update.
        assets: d.assets.map((a) =>
          a.id === entry.assetId && isNewestReading
            ? { ...a, currentHours: entry.hoursAtService, hoursUpdatedAt: new Date().toISOString() }
            : a,
        ),
      }));
      return null;
    },
    [data.assets],
  );

  const updateSpecs = useCallback((assetId: string, specs: AssetSpecs) => {
    setData((d) => ({
      ...d,
      assets: d.assets.map((a) => (a.id === assetId ? { ...a, specs } : a)),
    }));
  }, []);

  const resetDemoData = useCallback(() => setData(buildSeedData()), []);

  const value = useMemo(
    () => ({ ...data, ready, updateHours, addServiceLog, updateSpecs, resetDemoData }),
    [data, ready, updateHours, addServiceLog, updateSpecs, resetDemoData],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
