/**
 * Shared analytics engine for the dashboard.
 *
 * Centralizes the daily-log math that every chart needs:
 *   - union of logged dates across shots
 *   - carry-forward alignment (a shot contributes its last known value on
 *     every date, so a single failed scrape never creates a fake dip)
 *   - per-shot and aggregate daily gains (deltas between consecutive logs)
 *   - boost-window helpers + automatic "suspected boost" detection
 *
 * All functions are pure so they can be unit-tested and reused by any tab.
 */

import { Shot } from './types.ts';
import type { BoostEntry, PromoKind } from './boosts.ts';

export type MetricKey = 'views' | 'likes' | 'saves' | 'comments';
export const METRIC_KEYS: MetricKey[] = ['views', 'likes', 'saves', 'comments'];

export interface HistPoint {
  date: string;
  views: number;
  likes: number;
  saves: number;
  comments: number;
}

// ---------------------------------------------------------------------------
// Basic date helpers (all dates are YYYY-MM-DD strings, lexicographic-safe)
// ---------------------------------------------------------------------------
export function isoAddDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().split('T')[0];
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000
  );
}

/** Monday-first weekday index (0 = Mon … 6 = Sun) of a YYYY-MM-DD string. */
export function weekdayIndex(dateStr: string): number {
  return (new Date(dateStr + 'T00:00:00Z').getUTCDay() + 6) % 7;
}

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// History alignment
// ---------------------------------------------------------------------------
function sortedHistory(shot: Shot): HistPoint[] {
  return (Array.isArray(shot.history) ? shot.history : [])
    .filter((h: any) => h && h.date)
    .map((h: any) => ({
      date: h.date,
      views: h.views || 0,
      likes: h.likes || 0,
      saves: h.saves || 0,
      comments: h.comments || 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Sorted union of every logged date across the given shots. */
export function unionDates(shots: Shot[]): string[] {
  const set = new Set<string>();
  shots.forEach((s) => {
    (Array.isArray(s.history) ? s.history : []).forEach((h: any) => {
      if (h && h.date) set.add(h.date);
    });
  });
  return Array.from(set).sort();
}

/**
 * Carry-forward alignment: for each date in `dates`, the shot's most recent
 * known snapshot up to that date (or null before its first log).
 */
function alignShot(shot: Shot, dates: string[]): (HistPoint | null)[] {
  const hist = sortedHistory(shot);
  const out: (HistPoint | null)[] = [];
  let hi = 0;
  let last: HistPoint | null = null;
  for (const d of dates) {
    while (hi < hist.length && hist[hi].date <= d) {
      last = hist[hi];
      hi++;
    }
    out.push(last);
  }
  return out;
}

export interface DayAggregate extends HistPoint {
  shotsCount: number;
}

/**
 * Carry-forward alignment for every shot, computed once.
 *
 * Alignment is the expensive part of this module (one pass per shot per date),
 * and it used to be recomputed by aggregateTotals, buildGainMatrix and again
 * inside the stacked-project chart — the last of which called alignShot *inside*
 * a loop over dates, making it O(dates² × shots): 11.8s at 1,000 shots over a
 * year. Everything now derives from a single frame.
 */
export interface Frame {
  dates: string[];
  /** shot url → aligned snapshot per date (null before the shot's first log) */
  aligned: Map<string, (HistPoint | null)[]>;
  totals: DayAggregate[];
}

export function buildFrame(shots: Shot[], dates: string[]): Frame {
  const aligned = new Map<string, (HistPoint | null)[]>();
  const totals: DayAggregate[] = dates.map((date) => ({
    date,
    views: 0,
    likes: 0,
    saves: 0,
    comments: 0,
    shotsCount: 0,
  }));

  shots.forEach((shot) => {
    const hist = sortedHistory(shot);
    const row: (HistPoint | null)[] = new Array(dates.length);
    let hi = 0;
    let last: HistPoint | null = null;
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      while (hi < hist.length && hist[hi].date <= d) {
        last = hist[hi];
        hi++;
      }
      row[i] = last;
      if (last) {
        const t = totals[i];
        t.views += last.views;
        t.likes += last.likes;
        t.saves += last.saves;
        t.comments += last.comments;
        t.shotsCount += 1;
      }
    }
    aligned.set(shot.url, row);
  });

  return { dates, aligned, totals };
}

/** Aggregate carry-forward totals for every date. */
export function aggregateTotals(shots: Shot[], dates: string[]): DayAggregate[] {
  const result: DayAggregate[] = dates.map((date) => ({
    date,
    views: 0,
    likes: 0,
    saves: 0,
    comments: 0,
    shotsCount: 0,
  }));
  shots.forEach((shot) => {
    const aligned = alignShot(shot, dates);
    aligned.forEach((p, i) => {
      if (!p) return;
      result[i].views += p.views;
      result[i].likes += p.likes;
      result[i].saves += p.saves;
      result[i].comments += p.comments;
      result[i].shotsCount += 1;
    });
  });
  return result;
}

// ---------------------------------------------------------------------------
// Daily gains
// ---------------------------------------------------------------------------
export interface ShotGains {
  url: string;
  /** raw[i] = aligned[i] - aligned[i-1] (can be negative, null when unknown) */
  raw: Record<MetricKey, (number | null)[]>;
  /** gain[i] = max(0, raw[i]) with null → 0 */
  gain: Record<MetricKey, number[]>;
}

/** Gains from a pre-aligned row — the hot path when a Frame is available. */
function gainsFromAligned(
  url: string,
  aligned: (HistPoint | null)[] | undefined,
  dates: string[]
): ShotGains {
  const raw: Record<MetricKey, (number | null)[]> = {
    views: new Array(dates.length),
    likes: new Array(dates.length),
    saves: new Array(dates.length),
    comments: new Array(dates.length),
  };
  const gain: Record<MetricKey, number[]> = {
    views: new Array(dates.length),
    likes: new Array(dates.length),
    saves: new Array(dates.length),
    comments: new Array(dates.length),
  };
  // Metric-outer with hoisted array references: the inner loop then touches two
  // contiguous arrays instead of re-resolving raw[m] / gain[m] per date.
  for (let k = 0; k < METRIC_KEYS.length; k++) {
    const m = METRIC_KEYS[k];
    const rawM = raw[m];
    const gainM = gain[m];
    for (let i = 0; i < dates.length; i++) {
      const cur = aligned ? aligned[i] : null;
      const prev = aligned && i > 0 ? aligned[i - 1] : null;
      const r = cur && prev ? cur[m] - prev[m] : null;
      rawM[i] = r;
      gainM[i] = r !== null && r > 0 ? r : 0;
    }
  }
  return { url, raw, gain };
}

function shotGains(shot: Shot, dates: string[]): ShotGains {
  const aligned = alignShot(shot, dates);
  const raw: Record<MetricKey, (number | null)[]> = { views: [], likes: [], saves: [], comments: [] };
  const gain: Record<MetricKey, number[]> = { views: [], likes: [], saves: [], comments: [] };
  for (let i = 0; i < dates.length; i++) {
    const cur = aligned[i];
    const prev = i > 0 ? aligned[i - 1] : null;
    METRIC_KEYS.forEach((m) => {
      const r = cur && prev ? cur[m] - prev[m] : null;
      raw[m].push(r);
      gain[m].push(r !== null ? Math.max(0, r) : 0);
    });
  }
  return { url: shot.url, raw, gain };
}

export interface GainMatrix {
  dates: string[];
  perShot: Map<string, ShotGains>;
  /** aggregate clamped gains per date, per metric */
  agg: Record<MetricKey, number[]>;
  /** aggregate raw deltas per date, per metric (nulls treated as 0) */
  aggRaw: Record<MetricKey, number[]>;
  /** true where the day's delta was suppressed as untrustworthy */
  excluded: boolean[];
}

/**
 * @param excludedDates dates whose delta is not trustworthy (see dataQuality.ts).
 *        Their gains are forced to 0 / raw to null so that no chart, weekday
 *        bucket, heatmap cell, velocity figure or boost heuristic can be
 *        distorted by a staggered first capture or a partial-day window.
 */
export function buildGainMatrix(
  shots: Shot[],
  dates: string[],
  excludedDates?: Set<string>,
  frame?: Frame
): GainMatrix {
  const perShot = new Map<string, ShotGains>();
  const agg: Record<MetricKey, number[]> = {
    views: new Array(dates.length).fill(0),
    likes: new Array(dates.length).fill(0),
    saves: new Array(dates.length).fill(0),
    comments: new Array(dates.length).fill(0),
  };
  const aggRaw: Record<MetricKey, number[]> = {
    views: new Array(dates.length).fill(0),
    likes: new Array(dates.length).fill(0),
    saves: new Array(dates.length).fill(0),
    comments: new Array(dates.length).fill(0),
  };
  const blocked = dates.map((d) => (excludedDates ? excludedDates.has(d) : false));

  shots.forEach((shot) => {
    const g = frame ? gainsFromAligned(shot.url, frame.aligned.get(shot.url), dates) : shotGains(shot, dates);
    // Neutralize untrustworthy days before anything downstream can read them.
    if (excludedDates && excludedDates.size > 0) {
      for (let k = 0; k < METRIC_KEYS.length; k++) {
        const m = METRIC_KEYS[k];
        const gainM = g.gain[m];
        const rawM = g.raw[m];
        for (let i = 0; i < dates.length; i++) {
          if (blocked[i]) {
            gainM[i] = 0;
            rawM[i] = null;
          }
        }
      }
    }
    perShot.set(shot.url, g);
    for (let k = 0; k < METRIC_KEYS.length; k++) {
      const m = METRIC_KEYS[k];
      const aggM = agg[m];
      const aggRawM = aggRaw[m];
      const gainM = g.gain[m];
      const rawM = g.raw[m];
      for (let i = 0; i < dates.length; i++) {
        aggM[i] += gainM[i];
        const r = rawM[i];
        if (r !== null) aggRawM[i] += r;
      }
    }
  });
  return { dates, perShot, agg, aggRaw, excluded: blocked };
}

// ---------------------------------------------------------------------------
// Promotion helpers (paid boosts + free editorial features)
// ---------------------------------------------------------------------------
export function filterByKind(entries: BoostEntry[], kinds: PromoKind[]): BoostEntry[] {
  if (kinds.length === 0) return [];
  return entries.filter((e) => kinds.includes(e.kind));
}

export function dateInBoostWindow(date: string, entry: BoostEntry): boolean {
  if (date < entry.start) return false;
  if (entry.end && date > entry.end) return false;
  return true;
}

function boostsForShot(url: string, boosts: BoostEntry[]): BoostEntry[] {
  return boosts.filter((b) => b.shotUrl === url);
}

/** URLs of every shot that has at least one registry entry (optionally by kind). */
export function boostedUrlSet(boosts: BoostEntry[], kinds?: PromoKind[]): Set<string> {
  const list = kinds ? filterByKind(boosts, kinds) : boosts;
  return new Set(list.map((b) => b.shotUrl));
}

/**
 * Splits the aggregate daily gain of a metric into paid / featured / organic.
 * A day inside both a boost and a feature window counts as paid (the paid
 * spend is the more consequential attribution), so the three series always
 * sum back to the unmodified aggregate gain.
 */
export function attributionByDate(
  matrix: GainMatrix,
  entries: BoostEntry[],
  metric: MetricKey
): { paid: number[]; featured: number[]; organic: number[] } {
  const n = matrix.dates.length;
  const paid = new Array(n).fill(0);
  const featured = new Array(n).fill(0);
  const organic = new Array(n).fill(0);

  matrix.perShot.forEach((g, url) => {
    const mine = entries.filter((e) => e.shotUrl === url);
    matrix.dates.forEach((d, i) => {
      const v = g.gain[metric][i];
      if (v === 0) return;
      const inPaid = mine.some((e) => e.kind === 'boost' && dateInBoostWindow(d, e));
      const inFeat = mine.some((e) => e.kind === 'featured' && dateInBoostWindow(d, e));
      if (inPaid) paid[i] += v;
      else if (inFeat) featured[i] += v;
      else organic[i] += v;
    });
  });
  return { paid, featured, organic };
}

/**
 * Per-date aggregate gain attributable to boost windows: for every date, the
 * summed clamped gain of each boosted shot on dates inside its window(s).
 */
export function boostGainByDate(
  matrix: GainMatrix,
  boosts: BoostEntry[],
  metric: MetricKey
): number[] {
  const out = new Array(matrix.dates.length).fill(0);
  boosts.forEach((entry) => {
    const g = matrix.perShot.get(entry.shotUrl);
    if (!g) return;
    matrix.dates.forEach((d, i) => {
      if (dateInBoostWindow(d, entry)) out[i] += g.gain[metric][i];
    });
  });
  return out;
}

/** Gained views for one shot inside one boost window (for CTR = gained / impressions). */
export function gainedInWindow(
  matrix: GainMatrix,
  entry: BoostEntry,
  metric: MetricKey = 'views'
): number {
  const g = matrix.perShot.get(entry.shotUrl);
  if (!g) return 0;
  let sum = 0;
  matrix.dates.forEach((d, i) => {
    if (dateInBoostWindow(d, entry)) sum += g.gain[metric][i];
  });
  return sum;
}

// ---------------------------------------------------------------------------
// Suspected-boost detection
// ---------------------------------------------------------------------------
export interface SuspectedBoost {
  shotUrl: string;
  start: string;
  end: string;
  gained: number;
  peakGain: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Flags per-shot days whose view gain is wildly above that shot's own normal
 * daily gain (>= max(150, 5x median of its positive gains)), then merges
 * consecutive flagged days into windows. Windows already covered by a manual
 * boost entry for the same shot are dropped.
 */
export function detectSuspectedBoosts(
  shots: Shot[],
  matrix: GainMatrix,
  manualBoosts: BoostEntry[]
): SuspectedBoost[] {
  const out: SuspectedBoost[] = [];
  shots.forEach((shot) => {
    const g = matrix.perShot.get(shot.url);
    if (!g) return;
    const raws = g.raw.views.filter((v): v is number => v !== null && v > 0);
    if (raws.length < 3) return; // not enough signal
    const med = median(raws);
    const threshold = Math.max(150, med * 5);

    let winStart = -1;
    const flushWindow = (endIdx: number) => {
      if (winStart < 0) return;
      const startDate = matrix.dates[winStart];
      const endDate = matrix.dates[endIdx];
      let gained = 0;
      let peak = 0;
      for (let i = winStart; i <= endIdx; i++) {
        gained += g.gain.views[i];
        peak = Math.max(peak, g.gain.views[i]);
      }
      const covered = boostsForShot(shot.url, manualBoosts).some(
        (b) => dateInBoostWindow(startDate, b) || dateInBoostWindow(endDate, b)
      );
      if (!covered && gained >= 300) {
        out.push({ shotUrl: shot.url, start: startDate, end: endDate, gained, peakGain: peak });
      }
      winStart = -1;
    };

    for (let i = 0; i < matrix.dates.length; i++) {
      const r = matrix.excluded[i] ? null : g.raw.views[i];
      const flagged = r !== null && r >= threshold;
      if (flagged && winStart < 0) winStart = i;
      if (!flagged && winStart >= 0) flushWindow(i - 1);
    }
    flushWindow(matrix.dates.length - 1);
  });
  return out.sort((a, b) => b.gained - a.gained);
}

/**
 * Profile-level anomaly days (used by History badges and heatmap markers):
 * days whose aggregate view gain is > 3x the median daily gain.
 */
export function detectAnomalyDays(matrix: GainMatrix): Set<string> {
  const gains = matrix.agg.views.slice(1).filter((v) => v > 0);
  const med = median(gains);
  const set = new Set<string>();
  if (med <= 0) return set;
  matrix.dates.forEach((d, i) => {
    if (matrix.excluded[i]) return;
    if (i > 0 && matrix.agg.views[i] > med * 3 && matrix.agg.views[i] > 500) set.add(d);
  });
  return set;
}

// ---------------------------------------------------------------------------
// Titles / projects / collections
// ---------------------------------------------------------------------------
export function shotTitle(shot: Shot): string {
  if (shot.title) return shot.title;
  try {
    const parts = new URL(shot.url).pathname.split('/');
    const slug = parts[parts.length - 1];
    return slug.replace(/^\d+-/, '').replace(/-/g, ' ');
  } catch {
    return 'Untitled Dribbble Shot';
  }
}
