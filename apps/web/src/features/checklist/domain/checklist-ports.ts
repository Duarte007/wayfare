import type { ChecklistItem, Place, Stop, Trip } from '@wayfare/shared';

/** What the checklist screen needs from the device: the items and where the trip goes. */
export interface ChecklistData {
  trip: Trip;
  items: ChecklistItem[];
  places: Place[];
  stops: Stop[];
}

/** One edit of the checklist, saved atomically on the device and queued for sync. */
export interface ChecklistChange {
  items?: ChecklistItem[];
  removed?: string[];
}

export interface ChecklistRepository {
  /** Calls back with null when the trip isn't on this device. Returns an unsubscribe function. */
  observe(tripId: string, listener: (data: ChecklistData | null) => void): () => void;
  apply(change: ChecklistChange): Promise<void>;
}
