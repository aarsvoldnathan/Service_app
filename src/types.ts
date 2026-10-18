/** A replacement part number, e.g. { label: 'Oil filter', partNumber: 'HH164-32430' }. */
export type FilterSpec = {
  label: string;
  partNumber: string;
};

/** Service specs shown at the top of the service screen. All free text so any unit works. */
export type AssetSpecs = {
  lugNutTorque?: string;
  tirePressure?: string;
  oilCapacity?: string;
  oilType?: string;
  filters: FilterSpec[];
};

export type Asset = {
  id: string;
  name: string;
  serial: string;
  currentHours: number;
  /** ISO timestamp of the last time hours were entered. */
  hoursUpdatedAt: string;
  specs: AssetSpecs;
};

/** A recurring maintenance item, e.g. "Engine oil and filter every 250 h or 180 days". */
export type ServiceTask = {
  id: string;
  assetId: string;
  name: string;
  /** Repeat every N engine hours (optional). */
  intervalHours?: number;
  /** Repeat every N calendar days (optional). */
  intervalDays?: number;
  /** Engine hours reading when this was last done. */
  lastDoneHours: number;
  /** ISO timestamp of when this was last done. */
  lastDoneDate: string;
};

export type PartUsed = {
  name: string;
  partNumber?: string;
  quantity?: string;
};

/** One completed service entry (the history). */
export type ServiceLog = {
  id: string;
  assetId: string;
  /** Short title, e.g. "Engine oil and filter". */
  taskName: string;
  performedBy: string;
  /** ISO timestamp. */
  date: string;
  hoursAtService: number;
  /** What was done, in the technician's words. */
  description?: string;
  parts?: PartUsed[];
  /** Scheduled services this entry completed (their intervals restart). */
  completedTaskIds?: string[];
  notes?: string;
};

/** Input for a new service log; the store assigns the id. */
export type NewServiceLog = Omit<ServiceLog, 'id'>;
