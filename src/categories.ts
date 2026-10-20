import type { Category, ServiceTask, SpecField } from './types';

// Reusable spec fields. Ids stay stable so values survive a category change.
const F: Record<string, SpecField> = {
  oilType: { id: 'oilType', label: 'Engine oil type', placeholder: 'e.g. 15W-40 CK-4' },
  oilCapacity: { id: 'oilCapacity', label: 'Engine oil capacity', placeholder: 'e.g. 11 qt with filter' },
  hydraulicFluid: { id: 'hydraulicFluid', label: 'Hydraulic fluid', placeholder: 'e.g. Bobcat Superior SH' },
  hydraulicCapacity: { id: 'hydraulicCapacity', label: 'Hydraulic capacity', placeholder: 'e.g. 10 gal' },
  coolant: { id: 'coolant', label: 'Coolant', placeholder: 'e.g. 50/50 propylene glycol' },
  fuel: { id: 'fuel', label: 'Fuel', placeholder: 'e.g. Diesel #2' },
  trackTension: { id: 'trackTension', label: 'Track tension', placeholder: 'e.g. 1 in sag at center roller' },
  tirePressure: { id: 'tirePressure', label: 'Tire pressure', placeholder: 'e.g. 35 psi' },
  lugNutTorque: { id: 'lugNutTorque', label: 'Lug nut torque', placeholder: 'e.g. 120 ft-lb' },
  travelMotorOil: { id: 'travelMotorOil', label: 'Travel motor oil', placeholder: 'e.g. SAE 90 gear oil' },
  greaseType: { id: 'greaseType', label: 'Grease type', placeholder: 'e.g. Lithium EP2' },
  knifeTorque: { id: 'knifeTorque', label: 'Knife bolt torque', placeholder: 'e.g. 150 ft-lb' },
  knifePart: { id: 'knifePart', label: 'Knife / blade part #' },
  beltPart: { id: 'beltPart', label: 'Drive belt part #' },
  bladePart: { id: 'bladePart', label: 'Blade part #' },
  bladeTorque: { id: 'bladeTorque', label: 'Blade bolt torque', placeholder: 'e.g. 70 ft-lb' },
  batteryType: { id: 'batteryType', label: 'Battery type / voltage', placeholder: 'e.g. 24 V lead-acid' },
  platformCapacity: { id: 'platformCapacity', label: 'Platform capacity', placeholder: 'e.g. 500 lb' },
  inspectionDue: { id: 'inspectionDue', label: 'Annual inspection due', placeholder: 'e.g. March 2027' },
  couplerSize: { id: 'couplerSize', label: 'Hydraulic coupler size', placeholder: 'e.g. 1/2 in flat face' },
  hydraulicFlow: { id: 'hydraulicFlow', label: 'Hydraulic flow required', placeholder: 'e.g. 18-23 gpm' },
  mountType: { id: 'mountType', label: 'Mount type', placeholder: 'e.g. Bob-Tach / pin-on' },
  teethPart: { id: 'teethPart', label: 'Teeth / cutting edge part #' },
  tireSize: { id: 'tireSize', label: 'Tire size', placeholder: 'e.g. ST235/80R16' },
  bearingGrease: { id: 'bearingGrease', label: 'Wheel bearing grease' },
  brakeType: { id: 'brakeType', label: 'Brake type', placeholder: 'e.g. Electric, 2 axles' },
  gvwr: { id: 'gvwr', label: 'GVWR', placeholder: 'e.g. 14,000 lb' },
  hitch: { id: 'hitch', label: 'Hitch / ball size', placeholder: 'e.g. 2-5/16 in, pintle' },
  lightPlug: { id: 'lightPlug', label: 'Light plug', placeholder: 'e.g. 7-way' },
};

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'skid_steer',
    name: 'Skid steer / track loader',
    fields: [F.oilType, F.oilCapacity, F.hydraulicFluid, F.hydraulicCapacity, F.trackTension, F.tirePressure, F.lugNutTorque, F.coolant, F.fuel],
  },
  {
    id: 'excavator',
    name: 'Excavator',
    fields: [F.oilType, F.oilCapacity, F.hydraulicFluid, F.hydraulicCapacity, F.travelMotorOil, F.trackTension, F.greaseType, F.coolant, F.fuel],
  },
  {
    id: 'wood_chipper',
    name: 'Wood chipper',
    fields: [F.oilType, F.oilCapacity, F.knifePart, F.knifeTorque, F.beltPart, F.hydraulicFluid, F.tirePressure, F.lugNutTorque, F.fuel],
  },
  {
    id: 'lift',
    name: 'Lift',
    fields: [F.hydraulicFluid, F.hydraulicCapacity, F.batteryType, F.platformCapacity, F.tirePressure, F.lugNutTorque, F.oilType, F.inspectionDue],
  },
  {
    id: 'attachment',
    name: 'Attachment',
    fields: [F.mountType, F.couplerSize, F.hydraulicFlow, F.greaseType, F.teethPart],
  },
  {
    id: 'trailer',
    name: 'Trailer',
    fields: [F.tireSize, F.tirePressure, F.lugNutTorque, F.bearingGrease, F.brakeType, F.gvwr, F.hitch, F.lightPlug],
  },
  {
    id: 'mower',
    name: 'Mower',
    fields: [F.oilType, F.oilCapacity, F.bladePart, F.bladeTorque, F.beltPart, F.tirePressure, F.fuel],
  },
  {
    id: 'other',
    name: 'Other',
    fields: [F.oilType, F.oilCapacity, F.tirePressure, F.lugNutTorque, F.fuel],
  },
];

type NewTask = Omit<ServiceTask, 'id' | 'assetId'>;

/** The starter items for a machine with no factory template, by category. */
export function defaultTasksForCategory(categoryId: string | undefined, currentHours: number): NewTask[] {
  const now = new Date().toISOString();
  const every10 = (name: string): NewTask => ({
    name,
    kind: 'routine',
    intervalHours: 10,
    lastDoneHours: currentHours,
    lastDoneDate: now,
  });
  const byDays = (name: string, days: number, kind: NewTask['kind'] = 'major'): NewTask => ({
    name,
    kind,
    intervalDays: days,
    lastDoneHours: currentHours,
    lastDoneDate: now,
  });
  switch (categoryId) {
    case 'trailer':
      return [byDays('Check tires, lights and brakes', 30, 'routine'), byDays('Grease / repack wheel bearings', 365)];
    case 'attachment':
      return [every10('Grease all fittings'), every10('Check hoses, couplers and wear parts')];
    case 'lift':
      return [every10('Check fluid levels'), every10('Grease all fittings'), byDays('Annual inspection', 365)];
    default:
      return [every10('Clean filters (air / screens)'), every10('Check fluid levels'), every10('Grease all fittings')];
  }
}

/** Map pre-category spec values (builds 1-9) to field ids. */
export const LEGACY_SPEC_KEYS = ['lugNutTorque', 'tirePressure', 'oilCapacity', 'oilType'] as const;
