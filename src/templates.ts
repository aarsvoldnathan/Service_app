import { TaskKind } from './types';

/** One service item in a factory schedule. */
export type TemplateItem = {
  name: string;
  kind: TaskKind;
  hours?: number;
  days?: number;
  /** First service happens earlier (break-in), e.g. first oil change at 50 h. */
  firstAt?: number;
  notes?: string;
};

export type MachineTemplate = {
  id: string;
  make: string;
  model: string;
  type: string;
  /** True when every interval was read from the manufacturer's published chart. */
  verified: boolean;
  source: string;
  items: TemplateItem[];
};

const Y = 365; // "or every 12 months"

const r = (name: string, notes?: string): TemplateItem => ({ name, kind: 'routine', hours: 10, notes });
const m = (name: string, hours?: number, days?: number, extra: Partial<TemplateItem> = {}): TemplateItem => ({
  name,
  kind: 'major',
  hours,
  days,
  ...extra,
});

// ---- Bobcat compact track loaders (T66 / T76, Bobcat engine, Tier 4) ----
const bobcatCtl = (model: string, source: string): MachineTemplate => ({
  id: `bobcat-${model.toLowerCase()}`,
  make: 'Bobcat',
  model,
  type: 'Compact track loader',
  verified: true,
  source,
  items: [
    r('Clean filters (air / cab / cooler)', 'Air and main fuel filter: service when the display tells you to.'),
    r('Check fluid levels', 'Engine oil, hydraulic fluid, coolant (cold).'),
    r('Grease all fittings', 'Lift arms, links, cylinders, Bob-Tach, pivot pins, wedges.'),
    m('Check track tension', 100),
    m('Check track sprocket bolts', 100),
    m('Check accessory drive belt', 500, Y, { firstAt: 100 }),
    m('Replace track drive motor brake cavity fluid', 500, Y),
    m('Engine oil and filter', 750, Y),
    m('Replace fuel pre-filter and tank vent filter', 1000, Y),
    m('Replace hydraulic filters and fluid', 1000, Y, { notes: 'Main, case drain and charge filters, reservoir fluid and vent filter.' }),
    m('Replace coolant', 1500, 2 * Y),
  ],
});

// ---- Bobcat compact excavators ----
const bobcatE35to55 = (model: string): MachineTemplate => ({
  id: `bobcat-${model.toLowerCase()}`,
  make: 'Bobcat',
  model,
  type: 'Compact excavator',
  verified: true,
  source:
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1650908182/bobcat-assets/na-approved/products/excavators/compact-excavators/service-schedules/ss-exc-e32-e55-t4-b-0118.pdf',
  items: [
    r('Clean filters (air / fuel water drain)', 'Air filter: service when the display tells you to. Drain water from fuel filter.'),
    r('Check fluid levels', 'Engine oil, hydraulic fluid, coolant (cold).'),
    r('Grease all fittings', 'All pivot points, clamp, angle blade.'),
    r('Check track tension'),
    m('Grease swing bearing and pinion', 50, undefined, { notes: 'Every 10 h when working in water.' }),
    m('Drain water from fuel tank and filter', 50),
    m('Check travel motor oil', 250, Y),
    m('Engine oil and filter', 500, Y, { firstAt: 50 }),
    m('Replace fuel filter', 500, Y),
    m('Replace hydraulic filter, case drain filter and breather', 500, Y, { firstAt: 50 }),
    m('Check belts (alternator, A/C)', 500, Y, { firstAt: 50 }),
    m('Replace hydraulic fluid and filters', 1000, Y),
    m('Replace travel motor oil', 1000, Y),
    m('Replace coolant', undefined, 2 * Y),
  ],
});

const bobcatE20: MachineTemplate = {
  id: 'bobcat-e20',
  make: 'Bobcat',
  model: 'E20',
  type: 'Compact excavator',
  verified: true,
  source:
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1650574486/bobcat-assets/na-approved/products/excavators/compact-excavators/service-schedules/ss-exc-e19-e20-0315.pdf',
  items: [
    r('Clean filters (air / fuel water drain)', 'Check air cleaner indicator; drain fuel filter if water present.'),
    r('Check fluid levels', 'Engine oil, hydraulic fluid, coolant (cold).'),
    r('Grease all fittings', 'Pivot points, track expansion, clamp.'),
    r('Check track tension'),
    m('Grease swing bearing', 50, undefined, { notes: 'Every 10 h when working in water.' }),
    m('Drain water from fuel tank and filter', 50),
    m('Replace fuel filter', 250, Y),
    m('Check travel motor oil', 250, Y),
    m('Check alternator belt', 250, Y, { firstAt: 50 }),
    m('Engine oil and filter', 500, Y, { firstAt: 50 }),
    m('Replace hydraulic filter and breather cap', 500, Y, { firstAt: 100 }),
    m('Replace hydraulic fluid and filters', 1000, Y),
    m('Replace travel motor oil', 1000, Y, { firstAt: 100 }),
    m('Replace coolant', undefined, 2 * Y),
  ],
};

// ---- Bobcat mini track loaders: chart could not be read reliably, standard Bobcat intervals ----
const bobcatMtl = (model: string, source: string, driveMotor: boolean): MachineTemplate => ({
  id: `bobcat-${model.toLowerCase()}`,
  make: 'Bobcat',
  model,
  type: 'Mini track loader',
  verified: false,
  source,
  items: [
    r('Clean filters (air / cooler)'),
    r('Check fluid levels', 'Engine oil, hydraulic fluid, coolant.'),
    r('Grease all fittings'),
    m('Check track tension', 50),
    m('Check belts', 250, Y),
    m('Engine oil and filter', 250, Y, { firstAt: 50, notes: 'Confirm interval on the service decal for your serial.' }),
    m('Replace fuel filter and pre-filter', 500, Y, { notes: 'Confirm interval on the service decal for your serial.' }),
    m('Replace hydraulic filter and breather cap', 500, Y, { notes: 'Confirm interval on the service decal for your serial.' }),
    m('Replace hydraulic fluid', 1000, Y),
    ...(driveMotor ? [m('Replace drive motor oil', 1000, Y, { notes: 'Confirm interval on the service decal.' })] : []),
    m('Replace coolant', 1000, 2 * Y),
  ],
});

export const TEMPLATES: MachineTemplate[] = [
  bobcatCtl(
    'T66',
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1650573272/bobcat-assets/na-approved/products/loaders/compact-track-loaders/service-schedules/ss-ldr-t62-66-t4-b-0920.pdf',
  ),
  bobcatCtl(
    'T76',
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1650573321/bobcat-assets/na-approved/products/loaders/compact-track-loaders/service-schedules/ss-ldr-t76-t4-b-0920.pdf',
  ),
  bobcatE20,
  bobcatE35to55('E35'),
  bobcatE35to55('E50'),
  bobcatE35to55('E55'),
  bobcatMtl(
    'MT100',
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1669132242/bobcat-assets/na-approved/products/loaders/mini-track-loaders/service-schedules/ss-mtl-mt100-t4-k.pdf',
    false,
  ),
  bobcatMtl(
    'MT120',
    'https://res.cloudinary.com/doosan-bobcat/image/upload/v1740166646/bobcat-assets/na-approved/products/loaders/mini-track-loaders/service-schedules/ss-mtl-mt120-t4-k.pdf',
    true,
  ),
  {
    id: 'bobcat-t595',
    make: 'Bobcat',
    model: 'T595',
    type: 'Compact track loader',
    verified: false,
    source: 'https://heavyvehicleinspection.com/blog/post/bobcat-maintenance-schedule',
    items: [
      r('Clean filters (air / cab)'),
      r('Check fluid levels'),
      r('Grease lift arm, cylinders and pivots'),
      m('Check track tension', 50),
      m('Engine oil and filter', 250, undefined, { notes: 'Some serials allow 500 h; check the chart for your serial.' }),
      m('Fuel filters (main and pre-filter)', 500),
      m('Inspect drive belts', 500),
      m('Hydraulic filters and fluid', 1000, Y),
    ],
  },
  {
    id: 'kubota-l3901',
    make: 'Kubota',
    model: 'L3901',
    type: 'Tractor',
    verified: false,
    source: 'https://www.tractortechspecs.com/kubota_l3901_tractor_service.html',
    items: [
      r('Clean filters (air / radiator screen)'),
      r('Check fluid levels'),
      r('Grease all fittings'),
      m('Grease front axle hub bearings', 50),
      m('Engine oil and filter', 400, Y, { firstAt: 50, notes: 'Filter HH164-32430.' }),
      m('Fuel filter', 400, undefined, { notes: 'Filter 1J800-43172.' }),
      m('Transmission/hydraulic fluid and filter', 400, undefined, { notes: 'Kubota Super UDT-2. Filter HH3A0-82623.' }),
      m('Front axle oil', 400),
      m('Clean air cleaner element', 100),
      m('Replace air cleaner element', 1000, undefined, { notes: 'Element TA040-93230.' }),
      m('Flush and refill coolant', 2000, 2 * Y),
    ],
  },
  {
    id: 'honda-eu7000is',
    make: 'Honda',
    model: 'EU7000is',
    type: 'Generator',
    verified: false,
    source: 'https://blog.hondalawnparts.com/servicing-the-eu7000is-generator/',
    items: [
      r('Check engine oil level'),
      r('Clean / inspect air filter'),
      m('Engine oil change', 100, 182, { firstAt: 20 }),
      m('Check spark plugs', 100, 182),
      m('Clean spark arrester', 100, 182),
      m('Replace air filter element', 300, Y),
      m('Replace spark plugs', 300, Y),
      m('Valve clearance check (dealer)', 300, Y),
    ],
  },
];

export const findTemplate = (id?: string) => TEMPLATES.find((t) => t.id === id);
export const templateLabel = (t: MachineTemplate) => `${t.make} ${t.model}`;

/**
 * Turn a template item into a schedule entry for a machine at `currentHours`.
 * A break-in service (firstAt) on a machine that has not reached it yet is scheduled for that hour.
 */
export function scheduleFromTemplate(item: TemplateItem, currentHours: number) {
  let lastDoneHours = currentHours;
  if (item.firstAt !== undefined && item.hours && currentHours < item.firstAt) {
    lastDoneHours = item.firstAt - item.hours;
  }
  const notes = [item.notes, item.firstAt ? `First service at ${item.firstAt} h.` : undefined].filter(Boolean).join(' ');
  return {
    name: item.name,
    kind: item.kind,
    intervalHours: item.hours,
    intervalDays: item.days,
    lastDoneHours,
    lastDoneDate: new Date().toISOString(),
    notes: notes || undefined,
  };
}
