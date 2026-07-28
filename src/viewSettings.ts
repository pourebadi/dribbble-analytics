/**
 * View settings that survive a refresh.
 *
 * Filters, ranges and chart toggles used to live only in component state, so
 * reloading the page — or coming back tomorrow — silently threw them away and
 * dropped you back on defaults. That is fine for a toy and wrong for something
 * people work in: if you narrowed to one collection and excluded a campaign,
 * that is the view you meant, and it should still be there.
 *
 * Stored per profile so two accounts do not overwrite each other's view, and
 * written through a tiny subscribe/notify store so every reader stays in sync.
 * Anything unrecognised in storage is ignored rather than trusted, so an old or
 * corrupted entry can never put the dashboard into a broken state.
 */

export type TrafficMode = 'all' | 'no-paid' | 'organic';

export interface ViewSettings {
  rangePreset: '7d' | '14d' | '30d' | '90d' | 'all' | 'custom';
  customStart: string;
  customEnd: string;
  collection: string;
  /** quick traffic switch — 'all' means nothing is filtered out */
  traffic: TrafficMode;
  /** ids of individual promotions the reader chose to exclude */
  excludedIds: string[];
}

export const DEFAULT_VIEW: ViewSettings = {
  rangePreset: '30d',
  customStart: '',
  customEnd: '',
  collection: 'all',
  traffic: 'all',
  excludedIds: [],
};

const KEY = 'dribbble_view_settings';

function keyFor(profileUrl: string | null | undefined): string {
  return profileUrl ? `${KEY}:${profileUrl}` : KEY;
}

function sanitize(raw: any): ViewSettings {
  const v = { ...DEFAULT_VIEW };
  if (!raw || typeof raw !== 'object') return v;

  const presets = ['7d', '14d', '30d', '90d', 'all', 'custom'];
  if (presets.includes(raw.rangePreset)) v.rangePreset = raw.rangePreset;

  const isDate = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (isDate(raw.customStart)) v.customStart = raw.customStart;
  if (isDate(raw.customEnd)) v.customEnd = raw.customEnd;

  if (typeof raw.collection === 'string') v.collection = raw.collection;

  if (raw.traffic === 'no-paid' || raw.traffic === 'organic' || raw.traffic === 'all') {
    v.traffic = raw.traffic;
  }

  if (Array.isArray(raw.excludedIds)) {
    v.excludedIds = raw.excludedIds.filter((s: any) => typeof s === 'string');
  }
  return v;
}

export function loadViewSettings(profileUrl?: string | null): ViewSettings {
  try {
    const raw = localStorage.getItem(keyFor(profileUrl));
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_VIEW };
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

export function saveViewSettings(settings: ViewSettings, profileUrl?: string | null) {
  try {
    localStorage.setItem(keyFor(profileUrl), JSON.stringify(settings));
  } catch {
    /* storage unavailable — the session still works, it just will not persist */
  }
}

export function clearViewSettings(profileUrl?: string | null) {
  try {
    localStorage.removeItem(keyFor(profileUrl));
  } catch {
    /* ignore */
  }
}

/** Which promotion kinds a traffic mode removes. 'all' removes nothing. */
export function kindsForTraffic(mode: TrafficMode): ('boost' | 'featured')[] {
  if (mode === 'no-paid') return ['boost'];
  if (mode === 'organic') return ['boost', 'featured'];
  return [];
}
