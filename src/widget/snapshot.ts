// What the home-screen widget shows. The app saves this whenever hours or services change;
// the widget reads it (Android) without opening the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Level, LEVEL_LABEL, machineStatus, Thresholds } from '../maintenance';
import type { Asset, ServiceTask } from '../types';

export const WIDGET_KEY = 'service-ceo:widget';
export type Hex = `#${string}`;
export const LEVEL_HEX: Record<Level, Hex> = { red: '#FF5A4F', orange: '#FB923C', yellow: '#FACC15', green: '#3DD68C' };

export type WidgetSnapshot = {
  fleet: string;
  needService: number;
  total: number;
  last?: { name: string; serial: string; level: Level; label: string; hours: number };
  updatedAt: string;
};

export function buildSnapshot(fleet: string, assets: Asset[], tasks: ServiceTask[], th: Thresholds): WidgetSnapshot {
  const now = new Date();
  const statuses = assets.map((a) => machineStatus(a, tasks, now, th));
  const lastAsset = [...assets].sort((a, b) => b.hoursUpdatedAt.localeCompare(a.hoursUpdatedAt))[0];
  const lastStatus = lastAsset ? statuses.find((x) => x.asset.id === lastAsset.id) : undefined;
  return {
    fleet,
    needService: statuses.filter((x) => x.level !== 'green').length,
    total: assets.length,
    last:
      lastAsset && lastStatus
        ? { name: lastAsset.name, serial: lastAsset.serial, level: lastStatus.level, label: LEVEL_LABEL[lastStatus.level], hours: lastAsset.currentHours }
        : undefined,
    updatedAt: now.toISOString(),
  };
}

export async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}
