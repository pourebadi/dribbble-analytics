/**
 * Data-quality classification of logged days.
 *
 * Not every row in the daily log is a clean 24-hour observation, and treating
 * them all as equal corrupts every growth chart. Two real defects exist in this
 * dataset and both are detected automatically:
 *
 *  1. STAGGERED CAPTURE — on the very first run the scraper worked through the
 *     shots slowly (2026-07-13 carries per-shot timestamps spread from 14:27 to
 *     20:40 UTC, a 6h13m spread). Those 70 numbers are therefore snapshots of
 *     70 different moments, not one moment. Any delta computed against that row
 *     is meaningless.
 *
 *  2. SHORT WINDOW — the next run happened only ~1.3h later (21:57 UTC the same
 *     evening) but landed on the next calendar day in Asia/Tehran, so the log
 *     shows a "day" that actually covers a fraction of a day. Its delta absorbs
 *     the correction for defect (1) and shows up as a fake +20k spike.
 *
 * A day is usable for growth math only if it is a clean capture AND the window
 * since the previous clean capture is a plausible day. Everything else is
 * "warm-up": its totals are still true (they are cumulative counters, always
 * valid), but its *delta* is suppressed so it cannot distort trends, weekday
 * patterns, heatmaps, velocity or boost detection.
 *
 * The analysis baseline therefore becomes the first CLEAN day, and real growth
 * measurement starts from the day after it.
 */

import { Shot } from './types.ts';

/** Max acceptable spread between the first and last shot timestamp of one run. */
export const MAX_CAPTURE_SPREAD_MIN = 90;
/** Minimum plausible window between two snapshots to call it a day. */
export const MIN_WINDOW_HOURS = 18;

export type DayQuality = 'ok' | 'baseline' | 'staggered' | 'short-window';

export interface DayInfo {
  date: string;
  quality: DayQuality;
  /** true when the delta ending on this day may be used for growth math */
  usableDelta: boolean;
  firstTs: number | null;
  lastTs: number | null;
  /** minutes between the first and last shot captured in this run */
  spreadMin: number | null;
  /** hours since the previous day's capture */
  windowHours: number | null;
  reason: string;
}

export interface QualityReport {
  days: DayInfo[];
  byDate: Map<string, DayInfo>;
  /** first day whose capture is clean — the true analysis baseline */
  baselineDate: string | null;
  /** dates whose delta must be ignored */
  excludedDates: Set<string>;
  /** number of days dropped from growth math */
  excludedCount: number;
}

export function assessDataQuality(shots: Shot[], dates: string[]): QualityReport {
  const first = new Map<string, number>();
  const last = new Map<string, number>();

  shots.forEach((s) => {
    (Array.isArray(s.history) ? s.history : []).forEach((h: any) => {
      if (!h || !h.date || !h.timestamp) return;
      const f = first.get(h.date);
      const l = last.get(h.date);
      if (f === undefined || h.timestamp < f) first.set(h.date, h.timestamp);
      if (l === undefined || h.timestamp > l) last.set(h.date, h.timestamp);
    });
  });

  const days: DayInfo[] = [];
  let prevCleanTs: number | null = null;
  let baselineDate: string | null = null;

  dates.forEach((date, i) => {
    const f = first.get(date) ?? null;
    const l = last.get(date) ?? null;
    const spreadMin = f !== null && l !== null ? (l - f) / 60000 : null;
    const windowHours = f !== null && prevCleanTs !== null ? (f - prevCleanTs) / 3600000 : null;

    const staggered = spreadMin !== null && spreadMin > MAX_CAPTURE_SPREAD_MIN;
    const shortWindow = windowHours !== null && windowHours < MIN_WINDOW_HOURS;

    let quality: DayQuality;
    let reason: string;

    if (staggered) {
      quality = 'staggered';
      reason =
        `Shots on this day were captured over ${formatSpread(spreadMin!)} instead of one pass, ` +
        `so the 70 numbers are snapshots of different moments. Totals are still valid; the daily change is not.`;
    } else if (shortWindow) {
      quality = 'short-window';
      reason =
        `This snapshot was taken only ${windowHours!.toFixed(1)}h after the previous usable one instead of ~24h, ` +
        `so its change covers a partial window (and absorbs any correction from the previous run).`;
    } else if (baselineDate === null) {
      quality = 'baseline';
      reason =
        'First clean capture — growth is measured from here onward. There is no earlier clean day to compare against.';
    } else {
      quality = 'ok';
      reason = `Clean daily capture${windowHours !== null ? ` (${windowHours.toFixed(1)}h window)` : ''}.`;
    }

    // A clean capture becomes the reference point for the next window,
    // even if it is the baseline itself.
    const cleanCapture = !staggered;
    if (cleanCapture && !shortWindow && baselineDate === null) baselineDate = date;
    if (cleanCapture) prevCleanTs = f ?? prevCleanTs;

    const usableDelta = quality === 'ok';

    days.push({ date, quality, usableDelta, firstTs: f, lastTs: l, spreadMin, windowHours, reason });
  });

  const byDate = new Map(days.map((d) => [d.date, d]));
  const excludedDates = new Set(days.filter((d) => !d.usableDelta).map((d) => d.date));

  return {
    days,
    byDate,
    baselineDate,
    excludedDates,
    excludedCount: days.filter((d) => d.quality === 'staggered' || d.quality === 'short-window').length,
  };
}

function formatSpread(min: number): string {
  if (min < 60) return `${Math.round(min)} minutes`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

export const QUALITY_LABEL: Record<DayQuality, string> = {
  ok: 'clean',
  baseline: 'baseline',
  staggered: 'staggered capture',
  'short-window': 'partial window',
};
