import type { AccentKey, ThemeMode } from './theme';

/** A group of machines with its own members and status rules (e.g. "Rental Fleet", "Home"). */
export type Fleet = {
  id: string;
  name: string;
  kind: 'work' | 'home';
  description?: string;
  /** Technicians who can see and work on this fleet. */
  memberIds: string[];
  /** Flag a machine's hours as stale after this many days without an update. */
  staleHoursDays: number;
  /** A routine item this many hours past due turns the machine orange. */
  orangeOverdueHours: number;
  /** A major item due within this many hours turns the machine yellow. */
  majorWarnHours: number;
};

/** An employee or family member who does service work. */
export type Technician = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  /** Default hourly rate for jobs and invoices. */
  hourlyRate?: number;
};

/** One spec line shown for a category, e.g. "Lug nut torque". */
export type SpecField = { id: string; label: string; placeholder?: string };

/** Equipment category (skid steer, excavator, trailer...) with its own spec fields. */
export type Category = { id: string; name: string; fields: SpecField[] };

/** A replacement part number, e.g. { label: 'Oil filter', partNumber: 'HH164-32430' }. */
export type FilterSpec = {
  label: string;
  partNumber: string;
};

/** Service specs shown at the top of the service screen. All free text so any unit works. */
export type AssetSpecs = {
  /** Spec values keyed by SpecField id. */
  values: Record<string, string>;
  /** Saved parts (filters, belts...) with part numbers. */
  filters: FilterSpec[];
};

/** A machine profile. */
export type Asset = {
  id: string;
  fleetId: string;
  /** Category id (skid_steer, excavator, ...). */
  category: string;
  name: string;
  serial: string;
  /** Value encoded in the machine's barcode / QR sticker. */
  barcode?: string;
  make?: string;
  model?: string;
  year?: string;
  /** Factory schedule template this machine was set up from. */
  templateId?: string;
  currentHours: number;
  /** ISO timestamp of the last time hours were entered. */
  hoursUpdatedAt: string;
  specs: AssetSpecs;
  notes?: string;
};

/**
 * routine: quick daily items (clean filters, check fluids, grease). Late = yellow, very late = orange.
 * major: scheduled services (oil, filters, fluids). Late = red.
 */
export type TaskKind = 'routine' | 'major';

/** A recurring maintenance item, e.g. "Engine oil and filter every 400 h or 1 year". */
export type ServiceTask = {
  id: string;
  assetId: string;
  name: string;
  kind: TaskKind;
  /** Repeat every N engine hours (optional). */
  intervalHours?: number;
  /** Repeat every N calendar days (optional). */
  intervalDays?: number;
  /** Engine hours reading when this was last done. */
  lastDoneHours: number;
  /** ISO timestamp of when this was last done. */
  lastDoneDate: string;
  /** Extra guidance, e.g. "First change at 50 h". */
  notes?: string;
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

export type ChecklistItem = { id: string; text: string; done: boolean };

/** Work handed to a technician (or a note to self) for one machine. */
export type Assignment = {
  id: string;
  assetId: string;
  /** Empty = unassigned / note to self. */
  technicianId?: string;
  createdAt: string;
  notes?: string;
  items: ChecklistItem[];
  status: 'open' | 'done';
  completedAt?: string;
};

export type Preferences = {
  theme: ThemeMode;
  accent: AccentKey;
  /** The person using this phone; pre-fills "Service done by". */
  meTechnicianId?: string;
  activeFleetId: string;
  business: BusinessInfo;
};

/** Shown on invoices. */
export type BusinessInfo = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  nextInvoiceNumber: number;
};

export type ShoppingItem = {
  id: string;
  fleetId: string;
  name: string;
  partNumber?: string;
  quantity?: string;
  assetId?: string;
  notes?: string;
  addedBy?: string;
  createdAt: string;
  purchased: boolean;
  purchasedAt?: string;
};

/** A job or work week: time and expenses that become one invoice. */
export type Job = {
  id: string;
  /** Fleet the job belongs to (used for online sharing and privacy). */
  fleetId?: string;
  title: string;
  /** Bill to. */
  client?: string;
  clientContact?: string;
  technicianId?: string;
  assetId?: string;
  rate: number;
  status: 'open' | 'invoiced' | 'paid';
  createdAt: string;
  invoiceNumber?: number;
  invoicedAt?: string;
  paidAt?: string;
  checkNumber?: string;
  notes?: string;
};

export type TimeEntry = {
  id: string;
  jobId: string;
  technicianId?: string;
  /** ISO date. */
  date: string;
  hours: number;
  note?: string;
};

export type Expense = {
  id: string;
  jobId: string;
  technicianId?: string;
  date: string;
  amount: number;
  description: string;
  /** Local file of the receipt photo. */
  receiptUri?: string;
};

export type AppData = {
  version: 3;
  categories: Category[];
  shopping: ShoppingItem[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  fleets: Fleet[];
  technicians: Technician[];
  assets: Asset[];
  tasks: ServiceTask[];
  logs: ServiceLog[];
  assignments: Assignment[];
  prefs: Preferences;
};
