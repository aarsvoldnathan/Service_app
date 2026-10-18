export type Asset = {
  id: string;
  name: string;
  serial: string;
  currentHours: number;
  /** ISO timestamp of the last time hours were entered. */
  hoursUpdatedAt: string;
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

/** One completed service entry (the history). */
export type ServiceLog = {
  id: string;
  assetId: string;
  taskName: string;
  performedBy: string;
  /** ISO timestamp. */
  date: string;
  hoursAtService: number;
  notes?: string;
};
