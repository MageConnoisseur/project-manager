/**
 * Persist priority-list project filters per workspace in localStorage.
 *
 * Key: workspace id (list id). Value: null = show all projects, or a project id.
 * Restored when the user returns to that workspace (design choice 4B).
 */

const STORAGE_KEY = 'priority-list-filter-by-workspace';

export type PriorityListFilterMap = Record<number, number | null>;

export function loadPriorityListFilters(): PriorityListFilterMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number | null>;
    const result: PriorityListFilterMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const workspaceId = Number(key);
      if (!Number.isNaN(workspaceId)) {
        result[workspaceId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function savePriorityListFilters(filters: PriorityListFilterMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    console.warn('[priorityListFilterStorage] Could not save filters to localStorage');
  }
}
