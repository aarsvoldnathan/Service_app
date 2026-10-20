// Put an import plan into the app's data.
import { newId } from '../store';
import type { Asset, AppData, ServiceLog } from '../types';
import { ImportPlan, norm, parseParts } from './core';

type StoreLike = {
  saveAsset: (a: Omit<Asset, 'id'> & { id?: string }) => { error: string | null; id?: string };
  replaceData: (fn: (d: AppData) => AppData) => void;
};

export type ApplyChoice = { newMachines: boolean; updates: boolean; logs: boolean };
export type ApplyResult = { machinesAdded: number; machinesUpdated: number; logsAdded: number; logIds: string[]; errors: string[] };

export function applyPlan(store: StoreLike, plan: ImportPlan, fleetId: string, choice: ApplyChoice = { newMachines: true, updates: true, logs: true }): ApplyResult {
  const out: ApplyResult = { machinesAdded: 0, machinesUpdated: 0, logsAdded: 0, logIds: [], errors: [] };
  const ids = new Map<string, string>(); // import key -> asset id
  const now = new Date().toISOString();

  if (choice.newMachines) {
    for (const m of plan.newMachines) {
      const r = store.saveAsset({
        fleetId,
        category: m.category ?? 'other',
        name: m.name,
        serial: m.serial ?? '',
        barcode: m.barcode,
        make: m.make,
        model: m.model,
        year: m.year,
        currentHours: m.hours ?? 0,
        hoursUpdatedAt: now,
        specs: { values: { ...m.specs }, filters: [] },
        notes: m.notes,
      });
      if (r.id) {
        ids.set(m.key, r.id);
        out.machinesAdded++;
      } else if (r.error) out.errors.push(`${m.name}: ${r.error}`);
    }
  }

  const logs: ServiceLog[] = [];
  if (choice.logs) {
    for (const l of plan.logs) {
      if (l.duplicate) continue;
      const assetId = l.assetId ?? ids.get(l.machineKey);
      if (!assetId) continue;
      logs.push({
        id: newId(),
        assetId,
        taskName: l.taskName,
        performedBy: l.performedBy,
        date: l.date,
        hoursAtService: l.hours,
        description: l.description,
        parts: parseParts(l.partsText),
        notes: [l.notes, 'Imported from spreadsheet'].filter(Boolean).join(' · '),
      });
    }
    out.logsAdded = logs.length;
    out.logIds = logs.map((l) => l.id);
  }

  const updates = choice.updates ? plan.updatedMachines : [];
  out.machinesUpdated = updates.length;

  store.replaceData((d) => {
    const assets = d.assets.map((a) => {
      let next = a;
      const u = updates.find((x) => x.existingId === a.id);
      if (u) {
        next = {
          ...next,
          make: next.make || u.make,
          model: next.model || u.model,
          year: next.year || u.year,
          serial: next.serial || u.serial || '',
          barcode: next.barcode || u.barcode,
          specs: { ...next.specs, values: { ...u.specs, ...next.specs.values } },
        };
        if (u.hours !== undefined && u.hours > next.currentHours) next = { ...next, currentHours: u.hours, hoursUpdatedAt: now };
      }
      // A service at higher hours than the machine shows means the meter moved on.
      const top = Math.max(...logs.filter((l) => l.assetId === a.id).map((l) => l.hoursAtService), -1);
      if (top > next.currentHours) next = { ...next, currentHours: top, hoursUpdatedAt: now };
      return next;
    });
    // Imported services restart matching schedule items ("Engine oil" matches "Engine oil and filter").
    const tasks = d.tasks.map((t) => {
      const match = logs
        .filter((l) => l.assetId === t.assetId && (norm(l.taskName).includes(norm(t.name)) || norm(t.name).includes(norm(l.taskName))))
        .filter((l) => l.date > t.lastDoneDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return match ? { ...t, lastDoneDate: match.date, lastDoneHours: Math.max(t.lastDoneHours, match.hoursAtService) } : t;
    });
    return { ...d, assets, tasks, logs: [...logs, ...d.logs] };
  });
  return out;
}
