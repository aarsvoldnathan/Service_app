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
import { Asset, ServiceLog, ServiceTask } from './types';

const STORAGE_KEY = 'service-ceo:v1';

type Data = { assets: Asset[]; tasks: ServiceTask[]; logs: ServiceLog[] };

type StoreValue = Data & {
  ready: boolean;
  /** Returns an error message, or null on success. */
  updateHours: (assetId: string, hours: number) => string | null;
  resetDemoData: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>({ assets: [], tasks: [], logs: [] });
  const [ready, setReady] = useState(false);

  // Load saved data once; seed demo data on the very first launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setData(raw ? (JSON.parse(raw) as Data) : buildSeedData());
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

  const resetDemoData = useCallback(() => setData(buildSeedData()), []);

  const value = useMemo(
    () => ({ ...data, ready, updateHours, resetDemoData }),
    [data, ready, updateHours, resetDemoData],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
