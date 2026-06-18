/**
 * Persist priority-list status filters per workspace in localStorage.
 *
 * Key: workspace id. Value: "active" (default), "completed", "scheduled", or "all".
 */

import type { PriorityListStatusFilter } from './taskVisibility';

const STORAGE_KEY = 'priority-list-status-filter-by-workspace';

export type PriorityListStatusFilterMap = Record<number, PriorityListStatusFilter>;

function isValidStatusFilter(value: unknown): value is PriorityListStatusFilter {
  return (
    value === 'active' ||
    value === 'completed' ||
    value === 'scheduled' ||
    value === 'all'
  );
}

export function loadPriorityListStatusFilters(): PriorityListStatusFilterMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: PriorityListStatusFilterMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const workspaceId = Number(key);
      if (!Number.isNaN(workspaceId) && isValidStatusFilter(value)) {
        result[workspaceId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function savePriorityListStatusFilters(filters: PriorityListStatusFilterMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    console.warn('[priorityListStatusFilterStorage] Could not save filters to localStorage');
  }
}
