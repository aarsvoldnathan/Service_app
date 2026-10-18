import { Asset, ServiceLog, ServiceTask } from './types';

const DAY = 86_400_000;

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** Demo data so the dashboard has something to show on first launch. */
export function buildSeedData(): {
  assets: Asset[];
  tasks: ServiceTask[];
  logs: ServiceLog[];
} {
  const assets: Asset[] = [
    {
      id: 'a1',
      name: 'Kubota L3901 Tractor',
      serial: 'KBT-L3901-48213',
      currentHours: 412,
      hoursUpdatedAt: daysAgo(2),
      specs: {
        lugNutTorque: '75 ft-lb (sample)',
        tirePressure: 'Front 26 psi / Rear 18 psi (sample)',
        oilCapacity: '6.5 qt (sample)',
        oilType: '15W-40 diesel (sample)',
        filters: [
          { label: 'Oil filter', partNumber: 'SAMPLE-OF-101' },
          { label: 'Fuel filter', partNumber: 'SAMPLE-FF-102' },
          { label: 'Hydraulic filter', partNumber: 'SAMPLE-HF-103' },
        ],
      },
    },
    {
      id: 'a2',
      name: 'Honda EU7000 Generator',
      serial: 'HND-EU7000-90377',
      currentHours: 188,
      hoursUpdatedAt: daysAgo(12),
      specs: {
        oilCapacity: '1.2 qt (sample)',
        oilType: '10W-30 (sample)',
        filters: [
          { label: 'Air filter', partNumber: 'SAMPLE-AF-201' },
          { label: 'Spark plug', partNumber: 'SAMPLE-SP-202' },
        ],
      },
    },
    {
      id: 'a3',
      name: 'Bobcat T595 Skid Steer',
      serial: 'BBC-T595-11452',
      currentHours: 1264,
      hoursUpdatedAt: daysAgo(9),
      specs: {
        tirePressure: 'Tracks: check tension (sample)',
        oilCapacity: '11 qt (sample)',
        oilType: '15W-40 diesel (sample)',
        filters: [
          { label: 'Oil filter', partNumber: 'SAMPLE-OF-301' },
          { label: 'Fuel filter', partNumber: 'SAMPLE-FF-302' },
        ],
      },
    },
  ];

  const tasks: ServiceTask[] = [
    {
      id: 't1',
      assetId: 'a1',
      name: 'Engine oil and filter',
      intervalHours: 200,
      intervalDays: 365,
      lastDoneHours: 230,
      lastDoneDate: daysAgo(150),
    },
    {
      id: 't2',
      assetId: 'a1',
      name: 'Grease all fittings',
      intervalHours: 50,
      lastDoneHours: 370,
      lastDoneDate: daysAgo(40),
    },
    {
      id: 't3',
      assetId: 'a1',
      name: 'Hydraulic filter',
      intervalHours: 400,
      lastDoneHours: 20,
      lastDoneDate: daysAgo(300),
    },
    {
      id: 't4',
      assetId: 'a2',
      name: 'Engine oil change',
      intervalHours: 100,
      intervalDays: 365,
      lastDoneHours: 95,
      lastDoneDate: daysAgo(200),
    },
    {
      id: 't5',
      assetId: 'a2',
      name: 'Spark plug and air filter',
      intervalHours: 300,
      intervalDays: 730,
      lastDoneHours: 0,
      lastDoneDate: daysAgo(500),
    },
    {
      id: 't6',
      assetId: 'a3',
      name: 'Engine oil and filter',
      intervalHours: 250,
      lastDoneHours: 1010,
      lastDoneDate: daysAgo(120),
    },
    {
      id: 't7',
      assetId: 'a3',
      name: 'Fuel filters',
      intervalHours: 500,
      lastDoneHours: 800,
      lastDoneDate: daysAgo(260),
    },
  ];

  const logs: ServiceLog[] = [
    {
      id: 'l1',
      assetId: 'a1',
      taskName: 'Grease all fittings',
      performedBy: 'Sam R.',
      date: daysAgo(40),
      hoursAtService: 370,
    },
    {
      id: 'l2',
      assetId: 'a3',
      taskName: 'Engine oil and filter',
      performedBy: 'Jordan T.',
      date: daysAgo(18),
      hoursAtService: 1010,
      notes: 'Used 15W-40, 11 qt.',
    },
    {
      id: 'l3',
      assetId: 'a2',
      taskName: 'Engine oil change',
      performedBy: 'Nate',
      date: daysAgo(6),
      hoursAtService: 95,
    },
  ];

  return { assets, tasks, logs };
}
