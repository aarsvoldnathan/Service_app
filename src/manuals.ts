// Manufacturer-first sources for specs, schedules and part numbers.
// Used two ways: free links in the app (no AI cost) and the AI helper's search priority.

export type Maker = { match: RegExp; name: string; domains: string[]; manuals?: string; parts?: string };

/** Official sites by make. Add more here as the fleet grows. */
export const MAKERS: Maker[] = [
  {
    match: /bobcat|doosan/i,
    name: 'Bobcat',
    domains: ['bobcat.com', 'shop.bobcat.com'],
    manuals: 'https://shop.bobcat.com/manuals/operation-and-maintenance-manuals',
    parts: 'https://shop.bobcat.com/parts/manuals',
  },
  { match: /kubota/i, name: 'Kubota', domains: ['kubotausa.com', 'kubota.com'] },
  { match: /honda/i, name: 'Honda', domains: ['powerequipment.honda.com', 'honda.com'] },
  { match: /john\s*deere|deere/i, name: 'John Deere', domains: ['deere.com'] },
  { match: /caterpillar|\bcat\b/i, name: 'Caterpillar', domains: ['cat.com', 'parts.cat.com'] },
  { match: /case/i, name: 'CASE', domains: ['casece.com'] },
  { match: /takeuchi/i, name: 'Takeuchi', domains: ['takeuchi-us.com'] },
  { match: /vermeer/i, name: 'Vermeer', domains: ['vermeer.com'] },
  { match: /genie/i, name: 'Genie', domains: ['genielift.com'] },
  { match: /jlg/i, name: 'JLG', domains: ['jlg.com'] },
  { match: /toro/i, name: 'Toro', domains: ['toro.com'] },
  { match: /kohler/i, name: 'Kohler', domains: ['kohlerpower.com', 'kohlerengines.com'] },
  { match: /yanmar/i, name: 'Yanmar', domains: ['yanmar.com'] },
];

export function makerFor(make?: string): Maker | undefined {
  if (!make?.trim()) return undefined;
  return MAKERS.find((m) => m.match.test(make));
}

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export type DocLink = { label: string; url: string; official: boolean };

/** Free one-tap lookups, official sources first. */
export function manualLinks(asset: { make?: string; model?: string; serial?: string }): DocLink[] {
  const model = [asset.make, asset.model].filter(Boolean).join(' ').trim();
  if (!model) return [];
  const maker = makerFor(asset.make);
  const site = maker ? ' ' + maker.domains.map((d) => `site:${d}`).join(' OR ') : '';
  const links: DocLink[] = [];
  if (maker?.manuals) links.push({ label: `${maker.name} operation & maintenance manuals`, url: maker.manuals, official: true });
  links.push({ label: 'Maintenance schedule (manufacturer)', url: google(`${model} maintenance schedule${site}`), official: !!maker });
  links.push({ label: "Operator's manual PDF (manufacturer)", url: google(`${model} operation and maintenance manual pdf${site}`), official: !!maker });
  links.push({ label: 'Filter & parts numbers (manufacturer)', url: google(`${model} filter part numbers${site}`), official: !!maker });
  if (maker?.parts) links.push({ label: `${maker.name} parts manuals`, url: maker.parts, official: true });
  if (asset.serial?.trim()) {
    links.push({ label: 'Search by serial number', url: google(`${model} serial ${asset.serial.trim()} parts`), official: false });
  }
  return links;
}

/** True when a URL is on the machine's manufacturer site (used to badge AI sources). */
export function isOfficial(url: string, make?: string): boolean {
  const maker = makerFor(make);
  if (!maker) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return maker.domains.some((d) => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}
