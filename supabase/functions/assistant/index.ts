// Service Ceo AI helper.
// The app sends a machine's details and a question; this function checks the person is signed in
// and in that fleet, applies a daily limit, then asks Claude (with web search for manufacturer data).
// The Claude API key is stored as the ANTHROPIC_API_KEY secret and never reaches the app.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-sonnet-5-5';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '40');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Machine = {
  name?: string;
  make?: string;
  model?: string;
  year?: string;
  serial?: string;
  category?: string;
  officialDomains?: string[];
  currentHours?: number;
  specFields?: { id: string; label: string }[];
  specs?: Record<string, string>;
  parts?: { label: string; partNumber: string }[];
  schedule?: { name: string; kind: string; intervalHours?: number; intervalDays?: number; status?: string; notes?: string }[];
  recentService?: { date: string; title: string; hours: number }[];
};

type Body = {
  mode: 'chat' | 'setup' | 'sheet';
  fleetId: string;
  machine: Machine;
  /** Earlier turns as plain text. */
  history?: { role: 'user' | 'assistant'; text: string }[];
  question?: string;
  /** Spreadsheet mode. */
  fileName?: string;
  sheets?: { name: string; rows: string[][] }[];
  specFields?: { id: string; label: string }[];
  categories?: { id: string; name: string }[];
};

const COLS = (fields: string[]) => ({ type: 'object', description: 'Field -> 0-based column index. Leave out fields that have no column.', properties: Object.fromEntries(fields.map((f) => [f, { type: 'integer' }])) });
const MAP_TOOL = {
  name: 'map_sheet',
  description: 'Say which sheet and columns hold the machine list and the service history.',
  input_schema: {
    type: 'object',
    properties: {
      machines: {
        type: 'object',
        description: 'Table with one row per machine (unit list / fleet list). Omit if there is none.',
        properties: {
          sheet: { type: 'string' },
          header_row: { type: 'integer', description: '0-based index of the header row in rows[].' },
          columns: COLS(['name', 'make', 'model', 'year', 'serial', 'barcode', 'category', 'hours', 'notes']),
          spec_columns: { type: 'object', description: 'Spec field id -> column index, for columns holding specs such as oil type or tire pressure.', additionalProperties: { type: 'integer' } },
        },
        required: ['sheet', 'header_row', 'columns'],
      },
      logs: {
        type: 'object',
        description: 'Table with one row per service/repair done (maintenance log / work history). Omit if there is none.',
        properties: {
          sheet: { type: 'string' },
          header_row: { type: 'integer' },
          columns: COLS(['date', 'machine', 'serial', 'make', 'model', 'hours', 'service', 'performedBy', 'description', 'parts', 'notes']),
        },
        required: ['sheet', 'header_row', 'columns'],
      },
      category_map: { type: 'object', description: 'Text seen in the type/category column -> category id.', additionalProperties: { type: 'string' } },
      notes: { type: 'string', description: 'One or two plain sentences for the person: what was found, anything that could not be matched.' },
    },
  },
};

// The one tool Claude uses to hand back changes for the person to review.
const PROPOSE_TOOL = {
  name: 'propose_changes',
  description:
    'Propose service specs, parts and maintenance schedule items for this machine. The person reviews and chooses what to apply. ' +
    'Only include values you found in manufacturer documentation (or, failing that, authorized dealer parts lookups); never guess part numbers. In caveats, list any values that did not come from the manufacturer.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'One or two sentences on what is proposed and where it came from.' },
      specs: {
        type: 'array',
        description: 'Spec values. Use field_id from the provided spec fields when one matches; otherwise leave field_id empty and give a label.',
        items: {
          type: 'object',
          properties: {
            field_id: { type: 'string' },
            label: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['label', 'value'],
        },
      },
      parts: {
        type: 'array',
        description: 'Filters and common wear parts with manufacturer part numbers.',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, part_number: { type: 'string' } },
          required: ['label', 'part_number'],
        },
      },
      schedule: {
        type: 'array',
        description:
          'Maintenance items. kind "routine" = quick daily/10-hour checks (grease, check fluids, clean filters); "major" = scheduled services (oil, filters, fluids).',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            kind: { type: 'string', enum: ['routine', 'major'] },
            interval_hours: { type: 'number' },
            interval_days: { type: 'number' },
            first_at_hours: { type: 'number', description: 'Break-in / first service hour, if the manufacturer lists one.' },
            notes: { type: 'string' },
          },
          required: ['name', 'kind'],
        },
      },
      caveats: { type: 'string', description: 'What the person should double-check (e.g. serial-number range, decal on the machine).' },
    },
    required: ['summary'],
  },
};

function machineText(m: Machine): string {
  const lines = [
    `Machine: ${m.name ?? ''}`,
    `Make: ${m.make ?? 'unknown'} | Model: ${m.model ?? 'unknown'} | Year: ${m.year ?? 'unknown'} | Serial number: ${m.serial || 'unknown'}`,
    `Type: ${m.category ?? 'unknown'} | Current hour meter: ${m.currentHours ?? 'unknown'} h`,
  ];
  if (m.officialDomains?.length) lines.push(`Official manufacturer domains (search these first): ${m.officialDomains.join(', ')}`);
  if (m.specFields?.length) {
    lines.push('Spec fields used by the app (field_id: label = current value):');
    m.specFields.forEach((f) => lines.push(`- ${f.id}: ${f.label} = ${m.specs?.[f.id] || '(empty)'}`));
  }
  if (m.parts?.length) lines.push('Saved parts: ' + m.parts.map((p) => `${p.label} ${p.partNumber}`).join('; '));
  if (m.schedule?.length) {
    lines.push('Current maintenance schedule:');
    m.schedule.forEach((s) =>
      lines.push(
        `- ${s.name} (${s.kind}) every ${[s.intervalHours && `${s.intervalHours} h`, s.intervalDays && `${s.intervalDays} days`].filter(Boolean).join(' or ') || '?'}${s.status ? `, ${s.status}` : ''}${s.notes ? ` | ${s.notes}` : ''}`,
      ),
    );
  }
  if (m.recentService?.length) {
    lines.push('Recent service: ' + m.recentService.map((r) => `${r.date.slice(0, 10)} ${r.title} at ${r.hours} h`).join('; '));
  }
  return lines.join('\n');
}

const SYSTEM_BASE = `You are the service assistant inside Service Ceo, an app that tracks maintenance for compact equipment (skid steers, track loaders, excavators, chippers, lifts, mowers, trailers) for rental fleets and households.
You help technicians while they work on a machine and help owners set machines up.
- SOURCE ORDER (most to least trusted): 1) the manufacturer's own operation & maintenance manual, service schedule chart or parts catalog (official domains are listed with the machine); 2) authorized dealer parts lookups; 3) engine/component makers (e.g. Kubota, Yanmar, Perkins engines; Donaldson/Fleetguard cross-reference) only to confirm. Never use forums, marketplaces or random PDF mirror sites for numbers.
- Search the official domains first. Only widen the search if the manufacturer has nothing for that value, and say which values did NOT come from the manufacturer.
- Note when values depend on serial-number range or model year.
- Never make up part numbers, torque values or capacities. If you cannot find a value, say so and tell them where to look (operator's manual, decal on the machine, dealer).
- Put safety first: mention lowering attachments, relieving hydraulic pressure, lockout, hot fluids and jacking safety when relevant.
- Write for someone standing at the machine on a phone: short, plain, step-by-step, units included.`;

function isOfficial(u: string, domains?: string[]) {
  if (!domains?.length) return false;
  try {
    const h = new URL(u).hostname.toLowerCase();
    return domains.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

async function callClaude(apiKey: string, payload: Record<string, unknown>) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Claude API error ${res.status}`);
  return data;
}

async function mapSheet(apiKey: string, body: Body) {
  const sheets = (body.sheets ?? []).slice(0, 12);
  if (!sheets.length) return json({ error: 'The spreadsheet looks empty.' }, 400);
  const system = `You read spreadsheets that equipment owners keep for their machines (skid steers, excavators, lifts, trailers, mowers...) and tell the Service Ceo app which columns hold what.
Rows are given as JSON arrays; row and column numbers are 0-based positions in those arrays. Row 0 is the first row of the sheet.
- "machines" = a list with one row per machine. "logs" = one row per service, repair or inspection done (they usually have a date).
- A single sheet can be a log that also names the machine on each row; then map it as "logs" with its machine/serial/make/model columns.
- "machine" in logs and "name" in machines = the unit name or number people use. "service" = the short title of the work; "description" = longer details if a separate column exists.
- Only use columns that really exist. Leave fields out rather than guessing.
- Spec field ids you may use for spec_columns: ${(body.specFields ?? []).map((f) => `${f.id} (${f.label})`).join(', ')}.
- Category ids for category_map: ${(body.categories ?? []).map((c) => `${c.id} (${c.name})`).join(', ')}.
Call map_sheet exactly once.`;
  const data = await callClaude(apiKey, {
    model: MODEL,
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: `File: ${body.fileName ?? 'spreadsheet'}\n\n${sheets.map((s) => `SHEET "${s.name}":\n${s.rows.map((r, i) => `${i}: ${JSON.stringify(r)}`).join('\n')}`).join('\n\n')}` }],
    tools: [MAP_TOOL],
    tool_choice: { type: 'auto' },
    output_config: { effort: 'medium' },
  });
  let mapping: unknown = null;
  let text = '';
  for (const b of data.content ?? []) {
    if (b.type === 'tool_use' && b.name === 'map_sheet') mapping = b.input;
    if (b.type === 'text') text += b.text;
  }
  if (!mapping) return json({ error: 'The AI could not read this spreadsheet. Match the columns by hand.' }, 422);
  return json({ mapping, text: text.trim() });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not_configured', message: 'The AI helper is not set up yet (missing Claude API key).' }, 503);

  // Who is asking?
  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Please sign in again.' }, 401);
  const userId = userData.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!body?.fleetId || (!body.machine && body.mode !== 'sheet')) return json({ error: 'Missing machine details.' }, 400);

  // Must be a member of the fleet (checked with the person's own permissions).
  const { data: member } = await userClient.from('fleet_members').select('role').eq('fleet_id', body.fleetId).eq('user_id', userId).maybeSingle();
  if (!member) return json({ error: 'You are not a member of this fleet.' }, 403);

  // Daily limit per person.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: count } = await admin.rpc('ai_count_request', { p_user: userId });
  if (typeof count === 'number' && count > DAILY_LIMIT) {
    return json({ error: `Daily AI limit reached (${DAILY_LIMIT} requests). Try again tomorrow.` }, 429);
  }

  if (body.mode === 'sheet') {
    try {
      return await mapSheet(apiKey, body);
    } catch (e) {
      return json({ error: `The AI helper had a problem: ${(e as Error).message}` }, 502);
    }
  }

  const m = body.machine;
  const context = machineText(m);
  const setup = body.mode === 'setup';

  const system = `${SYSTEM_BASE}

${
  setup
    ? `TASK: Look up this machine and call propose_changes exactly once with its service specs (matching the app's spec fields), filter and wear-part numbers, and the full factory maintenance schedule. Include the 10-hour/daily items (grease, check fluids, clean filters) as "routine" and everything else as "major" with hour and/or day intervals. Keep item names short. Then give a two-sentence summary.`
    : `If the person asks you to change, add or fill in specs, parts or schedule items, call propose_changes with only those items so they can review and apply them. Otherwise just answer.`
}

THE MACHINE:
${context}`;

  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [];
  (body.history ?? []).slice(-10).forEach((h) => {
    if (h.text?.trim()) messages.push({ role: h.role, content: h.text });
  });
  messages.push({
    role: 'user',
    content: setup ? `Fill in the specs, parts and maintenance schedule for this ${m.make ?? ''} ${m.model ?? ''}.` : (body.question ?? '').slice(0, 4000),
  });
  if (!setup && !body.question?.trim()) return json({ error: 'Type a question.' }, 400);

  try {
    const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: setup ? 6 : 3 }, PROPOSE_TOOL];
    let data = await callClaude(apiKey, {
      model: MODEL,
      max_tokens: 8000,
      system,
      messages,
      tools,
      tool_choice: { type: 'auto' },
      thinking: { type: 'between_tools' },
      output_config: { effort: setup ? 'high' : 'medium' },
    });
    // Long searches can pause; continue up to twice.
    for (let i = 0; i < 2 && data.stop_reason === 'pause_turn'; i++) {
      messages.push({ role: 'assistant', content: data.content });
      data = await callClaude(apiKey, {
        model: MODEL,
        max_tokens: 8000,
        system,
        messages,
        tools,
        tool_choice: { type: 'auto' },
        thinking: { type: 'between_tools' },
        output_config: { effort: setup ? 'high' : 'medium' },
      });
    }

    let text = '';
    const sources = new Map<string, string>();
    let proposal: unknown = null;
    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        text += block.text;
        for (const c of block.citations ?? []) if (c.url) sources.set(c.url, c.title ?? c.url);
      } else if (block.type === 'tool_use' && block.name === 'propose_changes') {
        proposal = block.input;
      } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        // Keep result titles as a fallback source list when nothing was cited.
        for (const r of block.content) if (r.url && sources.size < 12 && !sources.has(r.url)) sources.set(r.url, r.title ?? r.url);
      }
    }
    if (!text.trim() && proposal) text = (proposal as { summary?: string }).summary ?? '';

    return json({
      text: text.trim(),
      proposal,
      // Manufacturer pages first.
      sources: Array.from(sources, ([u, t]) => ({ url: u, title: t }))
        .sort((a, b) => Number(isOfficial(b.url, m.officialDomains)) - Number(isOfficial(a.url, m.officialDomains)))
        .slice(0, 8),
      usage: { remainingToday: typeof count === 'number' ? Math.max(0, DAILY_LIMIT - count) : undefined },
    });
  } catch (e) {
    return json({ error: `The AI helper had a problem: ${(e as Error).message}` }, 502);
  }
});
