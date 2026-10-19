import { AppData, ServiceTask, TaskKind } from './types';

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** The three quick items every machine gets by default (every 10 engine hours). */
export const DEFAULT_ROUTINE_ITEMS: { name: string; grease: boolean }[] = [
  { name: 'Clean filters (air / screens)', grease: false },
  { name: 'Check fluid levels', grease: false },
  { name: 'Grease all fittings', grease: true },
];

export function defaultRoutineTasks(
  assetId: string,
  currentHours: number,
  opts: { includeGrease?: boolean } = {},
): Omit<ServiceTask, 'id'>[] {
  return DEFAULT_ROUTINE_ITEMS.filter((i) => opts.includeGrease !== false || !i.grease).map(
    (i) => ({
      assetId,
      name: i.name,
      kind: 'routine' as TaskKind,
      intervalHours: 10,
      lastDoneHours: currentHours,
      lastDoneDate: new Date().toISOString(),
    }),
  );
}

type T = Omit<ServiceTask, 'id' | 'assetId'>;
const routine = (name: string, lastDoneHours: number, lastDays: number, notes?: string): T => ({
  name,
  kind: 'routine',
  intervalHours: 10,
  lastDoneHours,
  lastDoneDate: daysAgo(lastDays),
  notes,
});
const major = (
  name: string,
  intervalHours: number | undefined,
  intervalDays: number | undefined,
  lastDoneHours: number,
  lastDays: number,
  notes?: string,
): T => ({ name, kind: 'major', intervalHours, intervalDays, lastDoneHours, lastDoneDate: daysAgo(lastDays), notes });

/**
 * Demo data. Schedules follow published factory intervals (see notes on each item);
 * always confirm against the operator's manual for your serial number.
 */
export function buildSeedData(): AppData {
  const kubota: T[] = [
    routine('Clean filters (air / radiator screen)', 405, 1),
    routine('Check fluid levels', 400, 3, 'Engine oil, coolant, transmission/hydraulic fluid.'),
    routine('Grease all fittings', 398, 4),
    major('Grease front axle hub bearings', 50, undefined, 380, 14),
    major('Engine oil and filter', 400, 365, 50, 200, 'Kubota: first change at 50 h, then every 400 h. Filter HH164-32430.'),
    major('Fuel filter', 400, undefined, 50, 200, 'Filter 1J800-43172.'),
    major('Transmission/hydraulic fluid and filter', 400, undefined, 50, 200, 'Kubota Super UDT-2. Filter HH3A0-82623.'),
    major('Front axle oil', 400, undefined, 50, 200),
    major('Clean air cleaner element', 100, undefined, 330, 30),
    major('Replace air cleaner element', 1000, undefined, 0, 400, 'Element TA040-93230.'),
    major('Flush and refill coolant', 2000, 730, 0, 400),
  ];

  const bobcat: T[] = [
    routine('Clean filters (air / cab)', 1262, 1),
    routine('Check fluid levels', 1260, 1, 'Engine oil, hydraulic fluid, coolant.'),
    routine('Grease lift arm, cylinders and pivots', 1240, 6),
    major('Check track tension', 50, undefined, 1230, 9),
    major('Engine oil and filter', 250, undefined, 1010, 40, 'Bobcat CTL guide: 250 h. Some newer serials allow 500 h; check the chart for your serial.'),
    major('Fuel filters (main and pre-filter)', 500, undefined, 800, 120),
    major('Inspect drive belts', 500, undefined, 800, 120),
    major('Hydraulic filters and fluid', 1000, 365, 1000, 300, 'Replace hydraulic/hydrostatic and charge filters with the fluid.'),
  ];

  const honda: T[] = [
    routine('Check engine oil level', 185, 2, 'Honda: check before each use.'),
    routine('Clean / inspect air filter', 182, 5),
    major('Engine oil change', 100, 182, 150, 60, 'Honda: first change at 20 h or 1 month, then every 100 h or 6 months.'),
    major('Check spark plugs', 100, 182, 150, 60),
    major('Clean spark arrester', 100, 182, 150, 60),
    major('Replace air filter element', 300, 365, 0, 200),
    major('Replace spark plugs', 300, 365, 0, 200),
    major('Valve clearance check (dealer)', 300, 365, 0, 200),
  ];

  let n = 0;
  const tasks: ServiceTask[] = [
    ...kubota.map((t) => ({ ...t, id: `t${++n}`, assetId: 'a1' })),
    ...bobcat.map((t) => ({ ...t, id: `t${++n}`, assetId: 'a3' })),
    ...honda.map((t) => ({ ...t, id: `t${++n}`, assetId: 'a2' })),
  ];

  const bobcatOil = tasks.find((t) => t.assetId === 'a3' && t.name === 'Engine oil and filter');
  const bobcatGrease = tasks.find((t) => t.assetId === 'a3' && t.kind === 'routine' && t.name.startsWith('Grease'));

  return {
    version: 2,
    fleets: [
      {
        id: 'f-work',
        name: 'Rental Fleet',
        kind: 'work',
        description: 'Rental machines shared with employees.',
        memberIds: ['tech-1', 'tech-2', 'tech-3'],
        staleHoursDays: 7,
        orangeOverdueHours: 10,
        majorWarnHours: 10,
      },
      {
        id: 'f-home',
        name: 'Home',
        kind: 'home',
        description: 'Family vehicles and small equipment.',
        memberIds: ['tech-1', 'tech-4'],
        staleHoursDays: 30,
        orangeOverdueHours: 10,
        majorWarnHours: 10,
      },
    ],
    technicians: [
      { id: 'tech-1', name: 'Nate', role: 'Owner' },
      { id: 'tech-2', name: 'Sam R.', role: 'Technician' },
      { id: 'tech-3', name: 'Jordan T.', role: 'Technician' },
      { id: 'tech-4', name: 'Family member', role: 'Family' },
    ],
    assets: [
      {
        id: 'a1',
        templateId: 'kubota-l3901',
        fleetId: 'f-work',
        name: 'Kubota L3901 Tractor',
        make: 'Kubota',
        model: 'L3901',
        serial: 'KBT-L3901-48213',
        barcode: 'SC-0001',
        currentHours: 412,
        hoursUpdatedAt: daysAgo(2),
        specs: {
          oilCapacity: '1.75 gal (6.7 L)',
          oilType: '10W-30 or 15W-40, API CJ-4 / CI-4',
          filters: [
            { label: 'Engine oil filter', partNumber: 'HH164-32430' },
            { label: 'Fuel filter', partNumber: '1J800-43172' },
            { label: 'Air filter', partNumber: 'TA040-93230' },
            { label: 'Hydraulic filter', partNumber: 'HH3A0-82623' },
          ],
        },
        notes: 'Transmission/hydraulic fluid: Kubota Super UDT-2, about 7.5 gal (4WD).',
      },
      {
        id: 'a3',
        templateId: 'bobcat-t595',
        fleetId: 'f-work',
        name: 'Bobcat T595 Track Loader',
        make: 'Bobcat',
        model: 'T595',
        serial: 'BBC-T595-11452',
        barcode: 'SC-0003',
        currentHours: 1264,
        hoursUpdatedAt: daysAgo(9),
        specs: { filters: [] },
      },
      {
        id: 'a2',
        templateId: 'honda-eu7000is',
        fleetId: 'f-home',
        name: 'Honda EU7000is Generator',
        make: 'Honda',
        model: 'EU7000is',
        serial: 'HND-EU7000-90377',
        barcode: 'SC-0002',
        currentHours: 188,
        hoursUpdatedAt: daysAgo(12),
        specs: {
          oilCapacity: 'About 1.2 qt (1.1 L)',
          oilType: 'SAE 10W-30, API SJ or later',
          filters: [],
        },
      },
    ],
    tasks,
    logs: [
      {
        id: 'l1',
        assetId: 'a1',
        taskName: 'Grease front axle hub bearings',
        performedBy: 'Sam R.',
        date: daysAgo(14),
        hoursAtService: 380,
      },
      {
        id: 'l2',
        assetId: 'a3',
        taskName: 'Check track tension',
        performedBy: 'Jordan T.',
        date: daysAgo(9),
        hoursAtService: 1230,
      },
      {
        id: 'l3',
        assetId: 'a2',
        taskName: 'Engine oil change',
        performedBy: 'Nate',
        date: daysAgo(60),
        hoursAtService: 150,
        parts: [{ name: 'SAE 10W-30 oil', quantity: '1.2 qt' }],
      },
    ],
    assignments: [
      {
        id: 'as1',
        assetId: 'a3',
        technicianId: 'tech-3',
        createdAt: daysAgo(1),
        notes: 'Do this before it goes out on Monday.',
        items: [
          { id: 'i1', text: bobcatOil?.name ?? 'Engine oil and filter', done: false },
          { id: 'i2', text: bobcatGrease?.name ?? 'Grease', done: false },
          { id: 'i3', text: 'Wash machine', done: false },
        ],
        status: 'open',
      },
    ],
    prefs: { theme: 'system', accent: 'amber', meTechnicianId: 'tech-1', activeFleetId: 'f-work' },
  };
}
