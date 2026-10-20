import { computeDue, Thresholds } from './maintenance';
import { makerFor } from './manuals';
import { supabase } from './supabase';
import { Asset, Category, ServiceLog, ServiceTask } from './types';

export type ProposedSpec = { field_id?: string; label: string; value: string };
export type ProposedPart = { label: string; part_number: string };
export type ProposedItem = {
  name: string;
  kind: 'routine' | 'major';
  interval_hours?: number;
  interval_days?: number;
  first_at_hours?: number;
  notes?: string;
};
export type Proposal = {
  summary: string;
  specs?: ProposedSpec[];
  parts?: ProposedPart[];
  schedule?: ProposedItem[];
  caveats?: string;
};
export type AiAnswer = {
  text: string;
  proposal?: Proposal | null;
  sources: { url: string; title: string }[];
  usage?: { remainingToday?: number };
};
export type ChatTurn = { role: 'user' | 'assistant'; text: string };

/** Everything the helper needs to know about a machine (never wages or billing). */
export function machineContext(
  asset: Asset,
  category: Category,
  tasks: ServiceTask[],
  logs: ServiceLog[],
  thresholds: Thresholds,
) {
  const now = new Date();
  return {
    name: asset.name,
    make: asset.make,
    model: asset.model,
    year: asset.year,
    serial: asset.serial,
    category: category.name,
    officialDomains: makerFor(asset.make)?.domains ?? [],
    currentHours: asset.currentHours,
    specFields: category.fields.map((f) => ({ id: f.id, label: f.label })),
    specs: asset.specs.values,
    parts: asset.specs.filters,
    schedule: tasks
      .filter((t) => t.assetId === asset.id)
      .map((t) => ({
        name: t.name,
        kind: t.kind,
        intervalHours: t.intervalHours,
        intervalDays: t.intervalDays,
        status: computeDue(t, asset, now, thresholds).detail,
        notes: t.notes,
      })),
    recentService: logs
      .filter((l) => l.assetId === asset.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map((l) => ({ date: l.date, title: l.taskName, hours: l.hoursAtService })),
  };
}

/** Ask the AI helper. Throws an Error with a readable message on failure. */
export async function askAssistant(body: {
  mode: 'chat' | 'setup';
  fleetId: string;
  machine: ReturnType<typeof machineContext>;
  history?: ChatTurn[];
  question?: string;
}): Promise<AiAnswer> {
  const { data, error } = await supabase.functions.invoke('assistant', { body });
  if (error) {
    // Read the function's own error message when there is one.
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error === 'not_configured') {
          msg = 'The AI helper is not switched on yet. The fleet owner needs to add a Claude API key (see the setup steps).';
        } else if (j?.error) msg = j.error;
      }
    } catch {
      // keep the original message
    }
    throw new Error(msg);
  }
  return data as AiAnswer;
}
