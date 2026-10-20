// Keeps the home-screen widget current: saves a small snapshot and asks Android to redraw.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from '../store';
import { buildSnapshot, WIDGET_KEY } from './snapshot';

export function WidgetSync() {
  const { ready, activeFleet, fleetAssets, tasks, thresholds } = useStore();
  const key = fleetAssets.map((a) => `${a.id}:${a.currentHours}:${a.hoursUpdatedAt}`).join('|') + tasks.map((t) => t.lastDoneDate).join('|');
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      const snap = buildSnapshot(activeFleet.name, fleetAssets, tasks, thresholds);
      try {
        await AsyncStorage.setItem(WIDGET_KEY, JSON.stringify(snap));
      } catch {
        return;
      }
      if (Platform.OS !== 'android') return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requestWidgetUpdate } = require('react-native-android-widget');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { QuickHoursWidget } = require('./QuickHoursWidget');
        await requestWidgetUpdate({
          widgetName: 'QuickHours',
          renderWidget: () => <QuickHoursWidget data={snap} />,
          widgetNotFound: () => {},
        });
      } catch {
        // no widget on the home screen
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, activeFleet.id]);
  return null;
}
