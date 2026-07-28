/**
 * Growth Analysis tab — rebuilt.
 *
 * Implements the analytics roadmap:
 *  - Range engine (presets + custom picker) shared by every chart
 *  - Collections filter (projects parsed from titles + keyword sets like "System")
 *  - Boost Registry (manual marking of Dribbble Boosted Shots) + automatic
 *    spike detection + a global "Organic only" toggle:
 *      · time-series charts subtract gains earned inside boost windows
 *      · rankings/concentration drop boosted shots entirely
 *  - Growth Trend rebuilt: daily-gain / cumulative modes, 7-day moving
 *    average, boost windows shaded on the chart
 *  - Engagement Rate chart with daily views added (dual axis)
 *  - Best Days of the Week computed from *actual daily growth* per weekday
 *    (with the legacy publish-weekday view kept as a secondary mode)
 *  - Daily activity heatmap with weekday/month labels, legend, metric picker
 *    and boost/baseline markers
 *  - Portfolio Concentration as a Lorenz/Pareto curve with organic comparison
 *  - Tag Performance Matrix (bubble: reach x conversion x usage)
 *  - Top shots by growth/total, boost-aware
 *  - InfoTips on every card (texts centralized in helpTexts.ts)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  PieChart,
  Pie,
  BarChart,
} from 'recharts';
import {
  Eye,
  Heart,
  Bookmark,
  MessageCircle,
  Zap,
  TrendingUp,
  TrendingDown,
  Star,
  AlertTriangle,
  Layers,
  CalendarDays,
  ShieldCheck,
  Activity,
  Gauge,
} from 'lucide-react';

import { Shot, Profile } from '../types.ts';
import { DateRangePicker } from './DateRangePicker.tsx';
import { InfoTip } from './InfoTip.tsx';
import { BoostEntry, fetchBoosts } from '../boosts.ts';
import * as A from '../analytics.ts';
import type { MetricKey } from '../analytics.ts';
import { assessDataQuality, QUALITY_LABEL } from '../dataQuality.ts';
import { C, SERIES, compact, tooltipStyle, tooltipLabelStyle, gridProps, legendProps } from '../chartTheme.ts';

// ---------------------------------------------------------------------------
// Small shared UI atoms
// ---------------------------------------------------------------------------
const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
        active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function Seg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">{children}</div>
  );
}

const METRIC_META: Record<MetricKey, { label: string; color: string; Icon: any }> = {
  views: { label: 'Views', color: C.views, Icon: Eye },
  likes: { label: 'Likes', color: C.likes, Icon: Heart },
  saves: { label: 'Saves', color: C.saves, Icon: Bookmark },
  comments: { label: 'Comments', color: C.comments, Icon: MessageCircle },
};

const chartTooltipStyle = tooltipStyle;

function fmtDateLabel(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AnalysisTab({
  shots,
  profile,
  onOpenPromotions,
}: {
  shots: Shot[];
  profile: Profile | null;
  /** navigates to the Promotions page in the sidebar */
  onOpenPromotions?: () => void;
}) {
  // ----- Filters / global state -----
  const [rangePreset, setRangePreset] = useState<'7d' | '14d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [collection, setCollection] = useState<string>('all'); // 'all' | 'proj:NAME' | 'kw:WORD'
  const [exclusion, setExclusion] = useState<A.ExclusionMode>('none');

  const [boosts, setBoosts] = useState<BoostEntry[]>([]);
  const [boostsLoaded, setBoostsLoaded] = useState(false);

  // ----- Chart-local state -----
  const [trendMetric, setTrendMetric] = useState<MetricKey>('views');
  const [trendView, setTrendView] = useState<'daily' | 'cumulative'>('daily');
  const [bestDaysMode, setBestDaysMode] = useState<'growth' | 'publish'>('growth');
  const [bestDaysAgg, setBestDaysAgg] = useState<'avg' | 'total'>('avg');
  const [bestDaysMetric, setBestDaysMetric] = useState<'views' | 'engagement'>('views');
  const [heatMetric, setHeatMetric] = useState<MetricKey>('views');
  const [topShotsMode, setTopShotsMode] = useState<'growth' | 'total'>('growth');
  const [paretoOrganic, setParetoOrganic] = useState(false);
  const [attrMetric, setAttrMetric] = useState<MetricKey>('views');
  const [mixScope, setMixScope] = useState<'range' | 'all'>('range');
  const [shotMatrixAxis, setShotMatrixAxis] = useState<'likes' | 'saves'>('likes');

  useEffect(() => {
    let alive = true;
    fetchBoosts().then((b) => {
      if (alive) {
        setBoosts(b);
        setBoostsLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // ----- Collections -----
  const projectMap = useMemo(() => A.buildProjectMap(shots), [shots]);
  const projectCounts = useMemo(() => {
    const c = new Map<string, number>();
    shots.forEach((s) => {
      const p = projectMap.get(s.url) || 'Other';
      c.set(p, (c.get(p) || 0) + 1);
    });
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [shots, projectMap]);
  const keywordCollections = useMemo(() => A.keywordCollectionCounts(shots), [shots]);

  const filteredShots = useMemo(() => {
    if (collection === 'all') return shots;
    if (collection.startsWith('proj:')) {
      const name = collection.slice(5);
      return shots.filter((s) => (projectMap.get(s.url) || 'Other') === name);
    }
    if (collection.startsWith('kw:')) {
      const kw = collection.slice(3).toLowerCase();
      return shots.filter((s) => A.shotTitle(s).toLowerCase().includes(kw));
    }
    return shots;
  }, [shots, collection, projectMap]);

  // ----- Core matrices -----
  const dates = useMemo(() => A.unionDates(filteredShots), [filteredShots]);
  const totals = useMemo(() => A.aggregateTotals(filteredShots, dates), [filteredShots, dates]);

  /**
   * Data-quality gate. The first run captured shots over a 6-hour window and a
   * second run landed a few hours later, so those two rows are not valid daily
   * observations. Their deltas are suppressed here — once, centrally — so no
   * chart below can be distorted by them.
   */
  const quality = useMemo(() => assessDataQuality(filteredShots, dates), [filteredShots, dates]);
  const matrix = useMemo(
    () => A.buildGainMatrix(filteredShots, dates, quality.excludedDates),
    [filteredShots, dates, quality]
  );
  /** first date whose delta is trustworthy — analysis effectively starts here */
  const analysisStart = useMemo(() => {
    const firstOk = quality.days.find((d) => d.usableDelta);
    return firstOk ? firstOk.date : null;
  }, [quality]);
  const suspected = useMemo(
    () => A.detectSuspectedBoosts(filteredShots, matrix, boosts),
    [filteredShots, matrix, boosts]
  );
  const boostedUrls = useMemo(() => A.boostedUrlSet(boosts), [boosts]);
  const paidUrls = useMemo(() => A.boostedUrlSet(boosts, ['boost']), [boosts]);
  const featuredUrls = useMemo(() => A.boostedUrlSet(boosts, ['featured']), [boosts]);
  const hasPaid = paidUrls.size > 0;
  const hasFeatured = featuredUrls.size > 0;
  const excludeBoosted = exclusion !== 'none';

  /** the registry entries the current exclusion mode strips out */
  const excludedEntries = useMemo(
    () => A.filterByKind(boosts, A.kindsToExclude(exclusion)),
    [boosts, exclusion]
  );
  /** shot URLs removed entirely from rankings/concentration */
  const excludedUrls = useMemo(() => A.boostedUrlSet(excludedEntries), [excludedEntries]);

  const boostGain = useMemo(() => {
    const rec = {} as Record<MetricKey, number[]>;
    A.METRIC_KEYS.forEach((m) => (rec[m] = A.boostGainByDate(matrix, excludedEntries, m)));
    return rec;
  }, [matrix, excludedEntries]);

  /** paid / featured / organic split of daily gains (always unfiltered) */
  const attribution = useMemo(
    () => A.attributionByDate(matrix, boosts, attrMetric),
    [matrix, boosts, attrMetric]
  );

  // ----- Range resolution -----
  const firstDate = dates.length > 0 ? dates[0] : null;
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : new Date().toISOString().split('T')[0];
  const presetDays: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };

  let endStr = rangePreset === 'custom' && customEnd ? customEnd : lastDate;
  let startStr: string;
  if (rangePreset === 'all') startStr = firstDate || endStr;
  else if (rangePreset === 'custom') startStr = customStart || firstDate || endStr;
  else startStr = A.isoAddDays(endStr, -(presetDays[rangePreset] - 1));
  if (startStr > endStr) [startStr, endStr] = [endStr, startStr];

  const rangeIdx = useMemo(() => {
    const idx: number[] = [];
    dates.forEach((d, i) => {
      if (d >= startStr && d <= endStr) idx.push(i);
    });
    return idx;
  }, [dates, startStr, endStr]);

  const availableDates = useMemo(() => new Set(dates), [dates]);

  // Aggregate gains inside range, boost-adjusted when requested
  const gainAt = (m: MetricKey, i: number) =>
    excludeBoosted ? Math.max(0, matrix.agg[m][i] - boostGain[m][i]) : matrix.agg[m][i];

  // ----- KPIs: gained in range vs previous equal window -----
  const kpis = useMemo(() => {
    const spanDays = A.daysBetween(startStr, endStr) + 1;
    const prevEnd = A.isoAddDays(startStr, -1);
    const prevStart = A.isoAddDays(prevEnd, -(spanDays - 1));
    return A.METRIC_KEYS.map((m) => {
      let gained = 0;
      let prevGained = 0;
      dates.forEach((d, i) => {
        if (i === 0) return; // baseline day has no delta to attribute
        if (d >= startStr && d <= endStr) gained += gainAt(m, i);
        else if (d >= prevStart && d <= prevEnd) prevGained += gainAt(m, i);
      });
      const pct = prevGained > 0 ? ((gained - prevGained) / prevGained) * 100 : null;
      return { metric: m, gained, prevGained, pct };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, matrix, boostGain, excludeBoosted, startStr, endStr]);

  const rangeLabel =
    rangePreset === 'all'
      ? 'all time'
      : rangePreset === 'custom'
      ? `${startStr} → ${endStr}`
      : `last ${presetDays[rangePreset]} days`;

  // ----- Trend series (daily gains / cumulative), weekly-bucketed when long -----
  const trendData = useMemo(() => {
    const pts = rangeIdx
      .filter((i) => i > 0) // skip global baseline
      .map((i) => ({
        date: dates[i],
        gain: gainAt(trendMetric, i),
        rawGain: matrix.agg[trendMetric][i],
        boostPart: boostGain[trendMetric][i],
        total: totals[i][trendMetric],
      }));

    const useWeekly = pts.length > 70;
    let series: { name: string; date: string; Gain: number; Boost: number; Total: number }[];
    if (!useWeekly) {
      series = pts.map((p) => ({
        name: fmtDateLabel(p.date),
        date: p.date,
        Gain: p.gain,
        Boost: excludeBoosted ? 0 : Math.min(p.boostPart, p.rawGain),
        Total: p.total,
      }));
    } else {
      const byWeek: Record<string, { name: string; date: string; Gain: number; Boost: number; Total: number }> = {};
      pts.forEach((p) => {
        const wd = A.weekdayIndex(p.date);
        const weekStart = A.isoAddDays(p.date, -wd);
        if (!byWeek[weekStart]) {
          byWeek[weekStart] = { name: 'W/' + fmtDateLabel(weekStart), date: weekStart, Gain: 0, Boost: 0, Total: 0 };
        }
        byWeek[weekStart].Gain += p.gain;
        byWeek[weekStart].Boost += excludeBoosted ? 0 : Math.min(p.boostPart, p.rawGain);
        byWeek[weekStart].Total = p.total; // end-of-week snapshot
      });
      series = Object.keys(byWeek)
        .sort()
        .map((k) => byWeek[k]);
    }

    // 7-point moving average of the primary series
    const key = trendView === 'daily' ? 'Gain' : 'Total';
    const withMA = series.map((row, i) => {
      const from = Math.max(0, i - 6);
      const slice = series.slice(from, i + 1);
      const ma = slice.reduce((a, r) => a + (r as any)[key], 0) / slice.length;
      return { ...row, MA7: Math.round(ma) };
    });
    return { series: withMA, weekly: useWeekly };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIdx, dates, matrix, boostGain, totals, trendMetric, trendView, excludeBoosted]);

  // Boost windows intersecting the range (for chart shading)
  const shadeWindows = useMemo(() => {
    const labelFor = (d: string) => {
      // find nearest plotted point at or after d / at or before d
      const s = trendData.series;
      if (s.length === 0) return null;
      let first: string | null = null;
      let last: string | null = null;
      for (const row of s) {
        if (row.date >= d && first === null) first = row.name;
        if (row.date <= d) last = row.name;
      }
      return { first, last };
    };
    const windows: { x1: string; x2: string; kind: 'boost' | 'featured' | 'suspected' }[] = [];
    const push = (start: string, end: string | null, kind: 'boost' | 'featured' | 'suspected') => {
      const e = end || endStr;
      if (e < startStr || start > endStr) return;
      const a = labelFor(start < startStr ? startStr : start);
      const b = labelFor(e > endStr ? endStr : e);
      if (a?.first && b?.last) windows.push({ x1: a.first, x2: b.last, kind });
    };
    boosts.forEach((b) => {
      // a window that the current exclusion mode already removed isn't shaded
      if (excludedUrls.size > 0 && excludedEntries.some((e) => e.id === b.id)) return;
      push(b.start, b.end, b.kind);
    });
    if (!excludeBoosted) suspected.forEach((s) => push(s.start, s.end, 'suspected'));
    return windows;
  }, [boosts, suspected, trendData, startStr, endStr, excludeBoosted, excludedEntries, excludedUrls]);

  // ----- Engagement rate + views series -----
  const engSeries = useMemo(() => {
    const pts = rangeIdx
      .filter((i) => i > 0)
      .map((i) => {
        const v = gainAt('views', i);
        const l = gainAt('likes', i);
        const s = gainAt('saves', i);
        const c = gainAt('comments', i);
        return { date: dates[i], v, inter: l + s + c, l, s };
      });
    const useWeekly = pts.length > 70;
    let rows: { name: string; ViewsGained: number; inter: number; l: number; s: number }[];
    if (!useWeekly) {
      rows = pts.map((p) => ({ name: fmtDateLabel(p.date), ViewsGained: p.v, inter: p.inter, l: p.l, s: p.s }));
    } else {
      const byWeek: Record<string, { name: string; ViewsGained: number; inter: number; l: number; s: number }> = {};
      pts.forEach((p) => {
        const weekStart = A.isoAddDays(p.date, -A.weekdayIndex(p.date));
        if (!byWeek[weekStart]) byWeek[weekStart] = { name: 'W/' + fmtDateLabel(weekStart), ViewsGained: 0, inter: 0, l: 0, s: 0 };
        byWeek[weekStart].ViewsGained += p.v;
        byWeek[weekStart].inter += p.inter;
        byWeek[weekStart].l += p.l;
        byWeek[weekStart].s += p.s;
      });
      rows = Object.keys(byWeek).sort().map((k) => byWeek[k]);
    }
    return rows.map((r) => ({
      name: r.name,
      ViewsGained: r.ViewsGained,
      EngagementRate: r.ViewsGained > 0 ? +((r.inter / r.ViewsGained) * 100).toFixed(2) : 0,
      LikeRate: r.ViewsGained > 0 ? +((r.l / r.ViewsGained) * 100).toFixed(2) : 0,
      SaveRate: r.ViewsGained > 0 ? +((r.s / r.ViewsGained) * 100).toFixed(2) : 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIdx, dates, matrix, boostGain, excludeBoosted]);

  // ----- Best days of the week (growth-based) -----
  const weekdayGrowth = useMemo(() => {
    const agg = A.WEEKDAY_NAMES.map((name) => ({
      name,
      samples: 0,
      views: 0,
      engagement: 0,
    }));
    rangeIdx.forEach((i) => {
      if (i === 0) return;
      const w = A.weekdayIndex(dates[i]);
      agg[w].samples += 1;
      agg[w].views += gainAt('views', i);
      agg[w].engagement += gainAt('likes', i) + gainAt('saves', i) + gainAt('comments', i);
    });
    const minSamples = Math.min(...agg.map((a) => (a.samples > 0 ? a.samples : Infinity)));
    return {
      rows: agg.map((a) => ({
        name: a.name,
        samples: a.samples,
        Views: bestDaysAgg === 'avg' ? (a.samples ? Math.round(a.views / a.samples) : 0) : a.views,
        Engagement:
          bestDaysAgg === 'avg' ? (a.samples ? +(a.engagement / a.samples).toFixed(1) : 0) : a.engagement,
      })),
      limited: !isFinite(minSamples) || minSamples < 4,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIdx, dates, matrix, boostGain, excludeBoosted, bestDaysAgg]);

  // Legacy publish-weekday view
  const publishWeekday = useMemo(() => {
    const agg = A.WEEKDAY_NAMES.map((name) => ({ name, views: 0, likes: 0, count: 0 }));
    filteredShots.forEach((shot) => {
      if (!shot.posted) return;
      const d = new Date(shot.posted);
      if (isNaN(d.getTime())) return;
      const w = (d.getDay() + 6) % 7;
      agg[w].views += shot.views || 0;
      agg[w].likes += shot.likes || 0;
      agg[w].count += 1;
    });
    return agg.map((a) => ({
      name: a.name,
      Posts: a.count,
      AvgViews: a.count ? Math.round(a.views / a.count) : 0,
      AvgLikes: a.count ? Math.round(a.likes / a.count) : 0,
    }));
  }, [filteredShots]);

  // ----- Heatmap (last 16 weeks over the whole log) -----
  const heatmap = useMemo(() => {
    const gainByDate: Record<string, number> = {};
    dates.forEach((d, i) => {
      if (i > 0) gainByDate[d] = gainAt(heatMetric, i);
    });
    const maxGain = Math.max(1, ...Object.values(gainByDate));
    const boostDates = new Set<string>();
    const featuredDates = new Set<string>();
    boosts.forEach((b) =>
      dates.forEach((d) => {
        if (!A.dateInBoostWindow(d, b)) return;
        if (b.kind === 'boost') boostDates.add(d);
        else featuredDates.add(d);
      })
    );
    const suspectedDates = new Set<string>();
    suspected.forEach((s) =>
      dates.forEach((d) => {
        if (d >= s.start && d <= s.end) suspectedDates.add(d);
      })
    );

    const endD = new Date(lastDate + 'T00:00:00Z');
    const endMonday = new Date(endD);
    endMonday.setUTCDate(endD.getUTCDate() - ((endD.getUTCDay() + 6) % 7));
    const weeks: { iso: string; inLog: boolean; gain: number | null; isBaseline: boolean }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let prevMonth = -1;
    for (let w = 15; w >= 0; w--) {
      const col: { iso: string; inLog: boolean; gain: number | null; isBaseline: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(endMonday);
        cur.setUTCDate(endMonday.getUTCDate() - w * 7 + d);
        const iso = cur.toISOString().split('T')[0];
        const inLog = firstDate !== null && iso >= firstDate && iso <= lastDate;
        col.push({
          iso,
          inLog,
          gain: iso in gainByDate ? gainByDate[iso] : null,
          isBaseline: iso === firstDate,
        });
        if (d === 0) {
          const m = cur.getUTCMonth();
          if (m !== prevMonth) {
            monthLabels.push({
              col: 15 - w,
              label: cur.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
            });
            prevMonth = m;
          }
        }
      }
      weeks.push(col);
    }
    return { weeks, maxGain, boostDates, featuredDates, suspectedDates, monthLabels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, matrix, boostGain, excludeBoosted, heatMetric, boosts, suspected, firstDate, lastDate]);

  // ----- Portfolio concentration (Pareto / Lorenz) -----
  const pareto = useMemo(() => {
    const build = (list: Shot[]) => {
      const sorted = [...list].map((s) => s.views || 0).sort((a, b) => b - a);
      const total = sorted.reduce((a, b) => a + b, 0);
      const n = sorted.length;
      if (n === 0 || total === 0) return { curve: [], top3: 0, top10: 0, n: 0 };
      let cum = 0;
      const curve = [{ x: 0, y: 0 }].concat(
        sorted.map((v, i) => {
          cum += v;
          return { x: +(((i + 1) / n) * 100).toFixed(2), y: +((cum / total) * 100).toFixed(2) };
        })
      );
      const shareOf = (k: number) =>
        total > 0 ? (sorted.slice(0, k).reduce((a, b) => a + b, 0) / total) * 100 : 0;
      return { curve, top3: shareOf(3), top10: shareOf(Math.min(10, n)), n };
    };
    const all = build(filteredShots);
    const organic = build(filteredShots.filter((s) => !boostedUrls.has(s.url)));
    const noPaid = build(filteredShots.filter((s) => !paidUrls.has(s.url)));
    return { all, organic, noPaid, hasBoosts: boostedUrls.size > 0 };
  }, [filteredShots, boostedUrls, paidUrls]);

  const activePareto = paretoOrganic && pareto.hasBoosts ? pareto.organic : pareto.all;
  const paretoDelta = pareto.hasBoosts ? pareto.all.top3 - pareto.organic.top3 : 0;

  // ----- Tag performance matrix -----
  const tagMatrix = useMemo(() => {
    const base = excludeBoosted ? filteredShots.filter((s) => !excludedUrls.has(s.url)) : filteredShots;
    const agg: Record<string, { views: number; likes: number; count: number }> = {};
    base.forEach((shot) => {
      (shot.tags || []).forEach((t: any) => {
        const k = String(t).toLowerCase().trim();
        if (!k) return;
        if (!agg[k]) agg[k] = { views: 0, likes: 0, count: 0 };
        agg[k].views += shot.views || 0;
        agg[k].likes += shot.likes || 0;
        agg[k].count += 1;
      });
    });
    const rows = Object.entries(agg)
      .filter(([, v]) => v.count >= 2 && v.views > 0)
      .map(([name, v]) => ({
        name,
        short: name.length > 16 ? name.slice(0, 16) + '…' : name,
        avgViews: Math.round(v.views / v.count),
        likeRate: +((v.likes / v.views) * 100).toFixed(2),
        shots: v.count,
        totalViews: v.views,
      }));
    const avgX = rows.length ? rows.reduce((a, r) => a + r.avgViews, 0) / rows.length : 0;
    const avgY = rows.length ? rows.reduce((a, r) => a + r.likeRate, 0) / rows.length : 0;
    return {
      rows: rows.sort((a, b) => b.avgViews - a.avgViews),
      avgX: Math.round(avgX),
      avgY: +avgY.toFixed(2),
    };
  }, [filteredShots, excludeBoosted, excludedUrls]);

  // ----- Top shots (growth in range / total) -----
  const shotGrowthList = useMemo(() => {
    const base = excludeBoosted && topShotsMode === 'total'
      ? filteredShots.filter((s) => !excludedUrls.has(s.url))
      : filteredShots;
    return base.map((shot) => {
      const g = matrix.perShot.get(shot.url);
      const growth: Record<MetricKey, number> = { views: 0, likes: 0, saves: 0, comments: 0 };
      if (g) {
        rangeIdx.forEach((i) => {
          if (i === 0) return;
          A.METRIC_KEYS.forEach((m) => {
            let v = g.gain[m][i];
            if (excludeBoosted) {
              const inWindow = excludedEntries.some(
                (b) => b.shotUrl === shot.url && A.dateInBoostWindow(dates[i], b)
              );
              if (inWindow) v = 0;
            }
            growth[m] += v;
          });
        });
      }
      const totalsRec: Record<MetricKey, number> = {
        views: shot.views || 0,
        likes: shot.likes || 0,
        saves: shot.saves || 0,
        comments: shot.comments || 0,
      };
      const inRange = (b: BoostEntry) =>
        b.shotUrl === shot.url && (b.end || endStr) >= startStr && b.start <= endStr;
      const paidInRange = boosts.some((b) => b.kind === 'boost' && inRange(b));
      const featuredInRange = boosts.some((b) => b.kind === 'featured' && inRange(b));
      return { shot, growth, totals: totalsRec, paidInRange, featuredInRange };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredShots, matrix, rangeIdx, dates, boosts, excludedUrls, excludedEntries, excludeBoosted, topShotsMode, startStr, endStr]);

  const topShotsFor = (metric: MetricKey) =>
    [...shotGrowthList]
      .sort((a, b) =>
        topShotsMode === 'growth' ? b.growth[metric] - a.growth[metric] : b.totals[metric] - a.totals[metric]
      )
      .slice(0, 6);

  // ----- Projects table -----
  const projectRows = useMemo(() => {
    const gainedByUrl = new Map<string, number>();
    shotGrowthList.forEach((x) => gainedByUrl.set(x.shot.url, x.growth.views));
    const agg: Record<
      string,
      { shots: number; views: number; likes: number; saves: number; comments: number; gained: number }
    > = {};
    filteredShots.forEach((sh) => {
      const proj = projectMap.get(sh.url) || 'Other';
      if (!agg[proj]) agg[proj] = { shots: 0, views: 0, likes: 0, saves: 0, comments: 0, gained: 0 };
      const a = agg[proj];
      a.shots += 1;
      a.views += sh.views || 0;
      a.likes += sh.likes || 0;
      a.saves += sh.saves || 0;
      a.comments += sh.comments || 0;
      a.gained += gainedByUrl.get(sh.url) || 0;
    });
    const COLORS = SERIES;
    return Object.entries(agg)
      .map(([name, a]) => ({
        name,
        ...a,
        avgViews: Math.round(a.views / a.shots),
        engRate: a.views > 0 ? +(((a.likes + a.saves + a.comments) / a.views) * 100).toFixed(2) : 0,
      }))
      .sort((x, y) => y.views - x.views)
      .map((r, i) => ({ ...r, color: COLORS[i % COLORS.length] }));
  }, [filteredShots, projectMap, shotGrowthList]);

  const maxProjGained = Math.max(1, ...projectRows.map((r) => r.gained));
  /** quadrant reference lines for the project matrix */
  const avgOfAvgViews = projectRows.length
    ? Math.round(projectRows.reduce((a, r) => a + r.avgViews, 0) / projectRows.length)
    : 0;
  const avgEngRate = projectRows.length
    ? +(projectRows.reduce((a, r) => a + r.engRate, 0) / projectRows.length).toFixed(2)
    : 0;

  // ----- Views composition by project, over time (restored) -----
  const projectStack = useMemo(() => {
    const names = projectRows.slice(0, 6).map((r) => r.name);
    const colorMap: Record<string, string> = {};
    projectRows.forEach((r) => (colorMap[r.name] = r.color));
    const rows = rangeIdx.map((i) => {
      const row: any = { name: fmtDateLabel(dates[i]) };
      names.forEach((n) => (row[n] = 0));
      filteredShots.forEach((shot) => {
        const proj = projectMap.get(shot.url) || 'Other';
        if (!names.includes(proj)) return;
        const aligned = A.alignShot(shot, dates)[i];
        if (aligned) row[proj] += aligned.views;
      });
      return row;
    });
    return { rows, names, colorMap };
  }, [rangeIdx, dates, filteredShots, projectMap, projectRows]);

  // ----- Posting cadence vs performance (restored) -----
  const postingCadence = useMemo(() => {
    const byMonth: Record<string, { posts: number; views: number }> = {};
    filteredShots.forEach((shot) => {
      if (!shot.posted) return;
      const d = new Date(shot.posted);
      if (isNaN(d.getTime())) return;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { posts: 0, views: 0 };
      byMonth[key].posts += 1;
      byMonth[key].views += shot.views || 0;
    });
    return Object.keys(byMonth)
      .sort()
      .map((k) => {
        const [y, m] = k.split('-');
        const label = new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        });
        return {
          name: label,
          Posts: byMonth[k].posts,
          AvgViews: Math.round(byMonth[k].views / byMonth[k].posts),
        };
      });
  }, [filteredShots]);

  // ----- Top tags ROI radar (restored) -----
  const tagRadar = useMemo(
    () =>
      [...tagMatrix.rows]
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 6)
        .map((t) => ({
          name: t.short,
          full: t.name,
          Likes: Math.round((t.likeRate / 100) * t.avgViews),
          AvgViews: t.avgViews,
          shots: t.shots,
        })),
    [tagMatrix]
  );

  // ----- Period growth velocity (restored, quality-aware) -----
  const velocity = useMemo(() => {
    const spanDays = A.daysBetween(startStr, endStr) + 1;
    const periods = [
      { label: 'Current', from: startStr, to: endStr },
      {
        label: 'Previous',
        from: A.isoAddDays(startStr, -spanDays),
        to: A.isoAddDays(startStr, -1),
      },
      {
        label: '2 periods ago',
        from: A.isoAddDays(startStr, -spanDays * 2),
        to: A.isoAddDays(startStr, -spanDays - 1),
      },
    ];
    return periods
      .map((p) => {
        let views = 0;
        let likes = 0;
        let hasData = false;
        dates.forEach((d, i) => {
          if (i === 0 || matrix.excluded[i]) return;
          if (d >= p.from && d <= p.to) {
            views += gainAt('views', i);
            likes += gainAt('likes', i);
            hasData = true;
          }
        });
        return { name: p.label, NewViews: views, NewLikes: likes, hasData };
      })
      .filter((p) => p.hasData)
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, matrix, boostGain, excludeBoosted, startStr, endStr]);

  // ----- Shot performance matrix (restored) -----
  const shotMatrix = useMemo(() => {
    const base = excludeBoosted ? filteredShots.filter((s) => !excludedUrls.has(s.url)) : filteredShots;
    return base.map((shot) => ({
      url: shot.url,
      title: A.shotTitle(shot),
      views: shot.views || 0,
      likes: shot.likes || 0,
      saves: shot.saves || 0,
      project: projectMap.get(shot.url) || 'Other',
      boosted: boostedUrls.has(shot.url),
    }));
  }, [filteredShots, excludeBoosted, excludedUrls, projectMap, boostedUrls]);

  // ----- Engagement mix (fixed: range-aware + safe empty state) -----
  const engagementMix = useMemo(() => {
    let likes = 0;
    let saves = 0;
    let comments = 0;

    if (mixScope === 'range') {
      // interactions *gained* inside the selected range
      rangeIdx.forEach((i) => {
        if (i === 0) return;
        likes += gainAt('likes', i);
        saves += gainAt('saves', i);
        comments += gainAt('comments', i);
      });
    } else {
      const base = excludeBoosted ? filteredShots.filter((s) => !excludedUrls.has(s.url)) : filteredShots;
      base.forEach((s) => {
        likes += s.likes || 0;
        saves += s.saves || 0;
        comments += s.comments || 0;
      });
    }

    return [
      { name: 'Likes', value: likes, color: C.likes },
      { name: 'Saves', value: saves, color: C.saves },
      { name: 'Comments', value: comments, color: C.comments },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixScope, rangeIdx, matrix, boostGain, excludeBoosted, filteredShots, excludedUrls]);

  const totalInteractions = engagementMix.reduce((a, e) => a + e.value, 0);
  /** slices with a real value — an all-zero donut renders as an invisible ring */
  const mixSlices = useMemo(() => engagementMix.filter((e) => e.value > 0), [engagementMix]);

  // ----- Traffic attribution (paid vs featured vs organic) -----
  const attributionSummary = useMemo(() => {
    let paid = 0;
    let featured = 0;
    let organic = 0;
    rangeIdx.forEach((i) => {
      if (i === 0) return;
      paid += attribution.paid[i];
      featured += attribution.featured[i];
      organic += attribution.organic[i];
    });
    const total = paid + featured + organic;
    return {
      total,
      rows: [
        { name: 'Organic', value: organic, color: '#10B981' },
        { name: 'Featured (free)', value: featured, color: '#6366F1' },
        { name: 'Boosted (paid)', value: paid, color: '#EA4C89' },
      ],
    };
  }, [rangeIdx, attribution]);

  const attributionSeries = useMemo(() => {
    const pts = rangeIdx.filter((i) => i > 0);
    const useWeekly = pts.length > 70;
    const rows: { name: string; Organic: number; Featured: number; Paid: number }[] = [];
    if (!useWeekly) {
      pts.forEach((i) => {
        rows.push({
          name: fmtDateLabel(dates[i]),
          Organic: attribution.organic[i],
          Featured: attribution.featured[i],
          Paid: attribution.paid[i],
        });
      });
    } else {
      const byWeek: Record<string, { name: string; Organic: number; Featured: number; Paid: number }> = {};
      pts.forEach((i) => {
        const ws = A.isoAddDays(dates[i], -A.weekdayIndex(dates[i]));
        if (!byWeek[ws]) byWeek[ws] = { name: 'W/' + fmtDateLabel(ws), Organic: 0, Featured: 0, Paid: 0 };
        byWeek[ws].Organic += attribution.organic[i];
        byWeek[ws].Featured += attribution.featured[i];
        byWeek[ws].Paid += attribution.paid[i];
      });
      Object.keys(byWeek).sort().forEach((k) => rows.push(byWeek[k]));
    }
    return rows;
  }, [rangeIdx, dates, attribution]);

  // ----- Shot lifecycle: average daily views by shot age -----
  // Answers "how long does a shot keep earning?" by aligning every shot on its
  // own publish date rather than the calendar.
  const lifecycle = useMemo(() => {
    const buckets: { label: string; from: number; to: number }[] = [
      { label: '0–7d', from: 0, to: 7 },
      { label: '8–14d', from: 8, to: 14 },
      { label: '15–30d', from: 15, to: 30 },
      { label: '31–60d', from: 31, to: 60 },
      { label: '61–90d', from: 61, to: 90 },
      { label: '90d+', from: 91, to: 100000 },
    ];
    const acc = buckets.map((b) => ({ ...b, views: 0, days: 0, shots: new Set<string>() }));

    filteredShots.forEach((shot) => {
      if (!shot.posted) return;
      const pd = new Date(shot.posted);
      if (isNaN(pd.getTime())) return;
      const postedIso = pd.toISOString().split('T')[0];
      const g = matrix.perShot.get(shot.url);
      if (!g) return;
      dates.forEach((d, i) => {
        if (i === 0 || matrix.excluded[i]) return;
        const age = A.daysBetween(postedIso, d);
        if (age < 0) return;
        const b = acc.find((x) => age >= x.from && age <= x.to);
        if (!b) return;
        let v = g.gain.views[i];
        if (excludeBoosted) {
          const inWin = excludedEntries.some((e) => e.shotUrl === shot.url && A.dateInBoostWindow(d, e));
          if (inWin) return;
        }
        b.views += v;
        b.days += 1;
        b.shots.add(shot.url);
      });
    });

    return acc.map((b) => ({
      name: b.label,
      AvgDaily: b.days > 0 ? Math.round(b.views / b.days) : 0,
      shots: b.shots.size,
      observations: b.days,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredShots, matrix, dates, excludeBoosted, excludedEntries]);

  // ----- Momentum: recent half vs previous half of the range, per shot -----
  const momentum = useMemo(() => {
    const usable = rangeIdx.filter((i) => i > 0 && !matrix.excluded[i]);
    if (usable.length < 4) return { rows: [], enough: false };
    const mid = Math.floor(usable.length / 2);
    const older = usable.slice(0, mid);
    const recent = usable.slice(mid);

    const rows = filteredShots
      .map((shot) => {
        const g = matrix.perShot.get(shot.url);
        if (!g) return null;
        const sum = (idxs: number[]) =>
          idxs.reduce((a, i) => {
            if (excludeBoosted) {
              const inWin = excludedEntries.some(
                (e) => e.shotUrl === shot.url && A.dateInBoostWindow(dates[i], e)
              );
              if (inWin) return a;
            }
            return a + g.gain.views[i];
          }, 0);
        const prev = sum(older);
        const now = sum(recent);
        const prevRate = older.length ? prev / older.length : 0;
        const nowRate = recent.length ? now / recent.length : 0;
        const delta = nowRate - prevRate;
        const pct = prevRate > 0 ? (delta / prevRate) * 100 : null;
        return { shot, prevRate: +prevRate.toFixed(1), nowRate: +nowRate.toFixed(1), delta, pct, total: now + prev };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.total > 0);

    return { rows, enough: true, olderDays: older.length, recentDays: recent.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredShots, matrix, rangeIdx, dates, excludeBoosted, excludedEntries]);

  const rising = useMemo(
    () => [...momentum.rows].sort((a, b) => b.delta - a.delta).slice(0, 5),
    [momentum]
  );
  const cooling = useMemo(
    () => [...momentum.rows].sort((a, b) => a.delta - b.delta).slice(0, 5),
    [momentum]
  );

  // =========================================================================
  // Render
  // =========================================================================
  if (dates.length === 0) {
    return (
      <div className={`${CARD} p-10 text-center`}>
        <p className="text-sm font-bold text-slate-600">No daily log yet for this selection.</p>
        <p className="text-xs text-slate-400 mt-1">
          Run a sync (or widen the Collections filter) to populate the growth analysis.
        </p>
      </div>
    );
  }

  const heatColor = (gain: number | null, inLog: boolean) => {
    if (!inLog) return '#F1F5F9';
    if (gain === null) return '#E2E8F0';
    const t = Math.min(1, gain / heatmap.maxGain);
    const alpha = gain === 0 ? 0.08 : 0.15 + 0.85 * t;
    return `rgba(234, 76, 137, ${alpha})`;
  };

  return (
    <div className="space-y-6">
      {/* ===================== CONTROL BAR ===================== */}
      <div className={`${CARD} p-4`}>
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> Range <InfoTip k="range" />
            </span>
            <Seg>
              {(['7d', '14d', '30d', '90d', 'all'] as const).map((p) => (
                <SegBtn key={p} active={rangePreset === p} onClick={() => setRangePreset(p)}>
                  {p === 'all' ? 'All' : p}
                </SegBtn>
              ))}
              <SegBtn active={rangePreset === 'custom'} onClick={() => setRangePreset('custom')}>
                Custom
              </SegBtn>
            </Seg>
            {rangePreset === 'custom' && (
              <DateRangePicker
                start={customStart || firstDate || lastDate}
                end={customEnd || lastDate}
                min={firstDate}
                max={lastDate}
                availableDates={availableDates}
                onChange={(s, e) => {
                  setCustomStart(s);
                  setCustomEnd(e);
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Promotion exclusion: all / no paid / fully organic */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                Traffic <InfoTip k="excludeBoosted" />
              </span>
              <Seg>
                <SegBtn active={exclusion === 'none'} onClick={() => setExclusion('none')}>
                  All
                </SegBtn>
                <SegBtn active={exclusion === 'paid'} onClick={() => setExclusion('paid')}>
                  No paid
                </SegBtn>
                <SegBtn active={exclusion === 'all'} onClick={() => setExclusion('all')}>
                  Organic
                </SegBtn>
              </Seg>
            </div>

            {/* Boost registry */}
            <button
              onClick={() => onOpenPromotions?.()}
              title="Open the Promotions page to register boosts and features"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold border bg-white border-slate-200 text-slate-600 hover:border-pink-200 hover:text-pink-600 transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-pink-500" />
              Promotions
              <span
                className="px-1.5 rounded-full text-[10px] font-mono bg-pink-50 text-pink-600 border border-pink-100"
                title="Paid boosts registered"
              >
                {paidUrls.size}
              </span>
              <span
                className="px-1.5 rounded-full text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-100"
                title="Featured entries registered"
              >
                {featuredUrls.size}
              </span>
              {boostsLoaded && suspected.length > 0 && (
                <span
                  className="px-1.5 rounded-full text-[10px] font-mono bg-amber-100 text-amber-700 border border-amber-200"
                  title={`${suspected.length} unregistered spike(s) detected`}
                >
                  +{suspected.length}?
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collections chips */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5" /> Collections <InfoTip k="collections" />
          </span>
          <button
            onClick={() => setCollection('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              collection === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            All ({shots.length})
          </button>
          {projectCounts.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setCollection(collection === `proj:${name}` ? 'all' : `proj:${name}`)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                collection === `proj:${name}`
                  ? 'bg-pink-500 text-white border-pink-500 shadow-sm shadow-pink-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-pink-200'
              }`}
            >
              {name} ({count})
            </button>
          ))}
          {keywordCollections.map(({ keyword, count }) => (
            <button
              key={keyword}
              onClick={() => setCollection(collection === `kw:${keyword}` ? 'all' : `kw:${keyword}`)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                collection === `kw:${keyword}`
                  ? 'bg-violet-500 text-white border-violet-500 shadow-sm shadow-violet-200'
                  : 'bg-white text-violet-500 border-violet-200 hover:border-violet-300'
              }`}
              title={`Every shot whose title contains “${keyword}”`}
            >
              “{keyword}” ({count})
            </button>
          ))}
        </div>
      </div>

      {/* ===================== DATA QUALITY NOTICE ===================== */}
      {quality.excludedCount > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-sky-900 flex items-center gap-1.5">
              {quality.excludedCount} start-up day{quality.excludedCount > 1 ? 's are' : ' is'} excluded from growth
              math <InfoTip k="dataQuality" />
            </p>
            <p className="text-[11px] text-sky-700 font-medium mt-0.5 leading-relaxed">
              {quality.days
                .filter((d) => d.quality === 'staggered' || d.quality === 'short-window')
                .map((d) => `${d.date} (${QUALITY_LABEL[d.quality]})`)
                .join(', ')}
              . Their cumulative totals are still correct and still shown — only their day-over-day change is
              suppressed, because it would otherwise appear as a large fake spike.
              {analysisStart && ` Reliable growth measurement starts ${analysisStart}.`}
            </p>
          </div>
        </div>
      )}

      {/* ===================== KPI ROW ===================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ metric, gained, pct }) => {
          const meta = METRIC_META[metric];
          return (
            <div key={metric} className={`${CARD} p-5 relative overflow-hidden group`}>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl" style={{ background: meta.color + '14', color: meta.color }}>
                  <meta.Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Gained · {rangeLabel} {metric === 'views' && <InfoTip k="kpis" align="right" />}
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                +{gained.toLocaleString()}
              </h3>
              <p className="text-[11px] font-semibold mt-1.5 flex items-center gap-1">
                {pct === null ? (
                  <span className="text-slate-400">no previous window to compare</span>
                ) : pct >= 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600">+{pct.toFixed(1)}%</span>
                    <span className="text-slate-400">vs previous {rangeLabel.replace('last ', '')}</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-red-600">{pct.toFixed(1)}%</span>
                    <span className="text-slate-400">vs previous window</span>
                  </>
                )}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-wider mt-2 inline-block" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </section>

      {/* ===================== GROWTH TREND (REBUILT) ===================== */}
      <div className={`${CARD} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Growth Trend <InfoTip k="growthTrend" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {trendView === 'daily' ? 'Earned per day' : 'Running total'} · {rangeLabel}
              {trendData.weekly && ' · bucketed weekly'}
              {exclusion === 'paid' && ' · paid gains removed'}
              {exclusion === 'all' && ' · paid + featured gains removed'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Seg>
              {A.METRIC_KEYS.map((m) => (
                <SegBtn key={m} active={trendMetric === m} onClick={() => setTrendMetric(m)}>
                  {METRIC_META[m].label}
                </SegBtn>
              ))}
            </Seg>
            <Seg>
              <SegBtn active={trendView === 'daily'} onClick={() => setTrendView('daily')}>
                Daily gain
              </SegBtn>
              <SegBtn active={trendView === 'cumulative'} onClick={() => setTrendView('cumulative')}>
                Cumulative
              </SegBtn>
            </Seg>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData.series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />

              {shadeWindows.map((w, i) => (
                <ReferenceArea
                  key={i}
                  x1={w.x1}
                  x2={w.x2}
                  fill={w.kind === 'boost' ? '#EA4C89' : w.kind === 'featured' ? '#6366F1' : '#F59E0B'}
                  fillOpacity={w.kind === 'suspected' ? 0.06 : 0.08}
                  strokeOpacity={0}
                />
              ))}

              {trendView === 'daily' ? (
                <>
                  <Bar
                    dataKey="Gain"
                    name={`${METRIC_META[trendMetric].label} gained`}
                    fill={METRIC_META[trendMetric].color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    fillOpacity={0.85}
                  />
                  {!excludeBoosted && boosts.length > 0 && (
                    <Bar dataKey="Boost" name="of which promoted" fill="#0F172A" fillOpacity={0.25} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  )}
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="Total"
                  name={`Total ${METRIC_META[trendMetric].label.toLowerCase()}`}
                  stroke={METRIC_META[trendMetric].color}
                  fill={METRIC_META[trendMetric].color}
                  fillOpacity={0.12}
                  strokeWidth={2.5}
                />
              )}
              <Line type="monotone" dataKey="MA7" name="7-bucket moving avg" stroke="#0F172A" strokeWidth={1.75} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {(boosts.length > 0 || suspected.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400">
            {hasPaid && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-pink-500/20 border border-pink-300 inline-block" /> paid boost window
              </span>
            )}
            {hasFeatured && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-300 inline-block" /> featured window
              </span>
            )}
            {!excludeBoosted && suspected.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400/25 border border-amber-300 inline-block" /> detected spike (unregistered)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===================== TRAFFIC ATTRIBUTION ===================== */}
      {boosts.length > 0 && (
        <div className={`${CARD} p-6`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Traffic Attribution <InfoTip k="attribution" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                How much of the growth in {rangeLabel} was bought, gifted by Dribbble, or earned
              </p>
            </div>
            <Seg>
              {A.METRIC_KEYS.map((m) => (
                <SegBtn key={m} active={attrMetric === m} onClick={() => setAttrMetric(m)}>
                  {METRIC_META[m].label}
                </SegBtn>
              ))}
            </Seg>
          </div>

          {/* Share bar */}
          <div className="mb-5">
            <div className="flex h-9 rounded-xl overflow-hidden border border-slate-200">
              {attributionSummary.rows.map((r) => {
                const pct = attributionSummary.total > 0 ? (r.value / attributionSummary.total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={r.name}
                    className="flex items-center justify-center transition-all"
                    style={{ width: `${pct}%`, background: r.color }}
                    title={`${r.name}: ${r.value.toLocaleString()} (${pct.toFixed(1)}%)`}
                  >
                    {pct > 9 && (
                      <span className="text-[10px] font-black text-white drop-shadow-sm">{pct.toFixed(0)}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
              {attributionSummary.rows.map((r) => {
                const pct = attributionSummary.total > 0 ? (r.value / attributionSummary.total) * 100 : 0;
                return (
                  <span key={r.name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                    {r.name}
                    <span className="font-mono text-slate-700">
                      +{r.value.toLocaleString()}
                    </span>
                    <span className="text-slate-400 font-mono">({pct.toFixed(1)}%)</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Stacked daily split */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={attributionSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar dataKey="Organic" stackId="a" name="Organic" fill="#10B981" fillOpacity={0.8} maxBarSize={26} />
                <Bar dataKey="Featured" stackId="a" name="Featured (free)" fill="#6366F1" fillOpacity={0.85} maxBarSize={26} />
                <Bar dataKey="Paid" stackId="a" name="Boosted (paid)" fill="#EA4C89" fillOpacity={0.9} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
            Days covered by both a paid boost and a feature are counted as paid, so the three bands always add up to
            the unfiltered daily gain. Register promotions in the ⚡ Promotions panel to make this chart meaningful.
          </p>
        </div>
      )}

      {/* ===================== ENGAGEMENT RATE + VIEWS ===================== */}
      <div className={`${CARD} p-6`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Engagement Rate &amp; Views <InfoTip k="engagement" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              How well each day&rsquo;s new views converted into likes / saves / comments · {rangeLabel}
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-[260px] hidden md:block">
            High views + low rate ⇒ paid / feed traffic · Low views + high rate ⇒ small but engaged audience
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={engSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis yAxisId="views" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
              <YAxis yAxisId="rate" orientation="right" unit="%" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [String(n).includes('Rate') ? `${v}%` : Number(v).toLocaleString(), n]} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Bar yAxisId="views" dataKey="ViewsGained" name="Views gained" fill="#3B82F6" fillOpacity={0.25} radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Line yAxisId="rate" type="monotone" dataKey="EngagementRate" name="Engagement rate" stroke="#0F172A" strokeWidth={2.25} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="LikeRate" name="Like rate" stroke="#EA4C89" strokeWidth={1.75} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="SaveRate" name="Save rate" stroke="#8B5CF6" strokeWidth={1.75} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ===================== BEST DAYS + HEATMAP ROW ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Best days of the week */}
        <div className={`${CARD} p-6`}>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                  Best Days of the Week <InfoTip k="bestDays" />
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {bestDaysMode === 'growth'
                    ? `Actual ${bestDaysAgg === 'avg' ? 'average' : 'total'} growth earned on each weekday · ${rangeLabel}`
                    : 'Legacy: shot totals grouped by the weekday they were published (all time)'}
                </p>
              </div>
              {bestDaysMode === 'growth' && weekdayGrowth.limited && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" /> limited data
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Seg>
                <SegBtn active={bestDaysMode === 'growth'} onClick={() => setBestDaysMode('growth')}>
                  Weekly growth
                </SegBtn>
                <SegBtn active={bestDaysMode === 'publish'} onClick={() => setBestDaysMode('publish')}>
                  By publish day
                </SegBtn>
              </Seg>
              {bestDaysMode === 'growth' && (
                <>
                  <Seg>
                    <SegBtn active={bestDaysAgg === 'avg'} onClick={() => setBestDaysAgg('avg')}>
                      Avg
                    </SegBtn>
                    <SegBtn active={bestDaysAgg === 'total'} onClick={() => setBestDaysAgg('total')}>
                      Total
                    </SegBtn>
                  </Seg>
                  <Seg>
                    <SegBtn active={bestDaysMetric === 'views'} onClick={() => setBestDaysMetric('views')}>
                      Views
                    </SegBtn>
                    <SegBtn active={bestDaysMetric === 'engagement'} onClick={() => setBestDaysMetric('engagement')}>
                      Engagement
                    </SegBtn>
                  </Seg>
                </>
              )}
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {bestDaysMode === 'growth' ? (
                <BarChart data={weekdayGrowth.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                    labelFormatter={(label: any) => {
                      const row = weekdayGrowth.rows.find((r) => r.name === label);
                      return `${label} · ${row?.samples ?? 0} day${(row?.samples ?? 0) === 1 ? '' : 's'} sampled`;
                    }}
                  />
                  <Bar
                    dataKey={bestDaysMetric === 'views' ? 'Views' : 'Engagement'}
                    name={`${bestDaysAgg === 'avg' ? 'Avg' : 'Total'} ${bestDaysMetric === 'views' ? 'views' : 'interactions'} gained`}
                    fill={bestDaysMetric === 'views' ? '#3B82F6' : '#EA4C89'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  >
                    {weekdayGrowth.rows.map((r, i) => {
                      const vals = weekdayGrowth.rows.map((x) => (bestDaysMetric === 'views' ? x.Views : x.Engagement));
                      const max = Math.max(...vals);
                      const v = bestDaysMetric === 'views' ? r.Views : r.Engagement;
                      const base = bestDaysMetric === 'views' ? '#3B82F6' : '#EA4C89';
                      return <Cell key={i} fill={base} fillOpacity={v === max && max > 0 ? 1 : 0.45} />;
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <ComposedChart data={publishWeekday} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis yAxisId="v" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                  <YAxis yAxisId="p" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [Number(v).toLocaleString(), n === 'Posts' ? 'Shots published on this weekday' : n]} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Bar yAxisId="v" dataKey="AvgViews" name="Avg views / shot" fill="#3B82F6" fillOpacity={0.8} radius={[6, 6, 0, 0]} maxBarSize={34} />
                  <Line yAxisId="p" type="monotone" dataKey="Posts" name="Posts" stroke="#0F172A" strokeWidth={1.75} strokeDasharray="4 3" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          {bestDaysMode === 'growth' && (
            <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
              Tooltip shows how many of each weekday are in the log — the pattern gets more reliable every week the
              tracker runs.
            </p>
          )}
        </div>

        {/* Heatmap */}
        <div className={`${CARD} p-6`}>
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Daily Activity Heatmap <InfoTip k="heatmap" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {METRIC_META[heatMetric].label} gained per day · last 16 weeks
                {exclusion === 'paid' && ' · paid gains removed'}
                {exclusion === 'all' && ' · promoted gains removed'}
              </p>
            </div>
            <Seg>
              {A.METRIC_KEYS.map((m) => (
                <SegBtn key={m} active={heatMetric === m} onClick={() => setHeatMetric(m)}>
                  {METRIC_META[m].label.slice(0, 1)}
                </SegBtn>
              ))}
            </Seg>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-block min-w-full">
              {/* Month labels */}
              <div className="flex ml-9 mb-1 relative h-3.5">
                {heatmap.monthLabels.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-[9px] font-black text-slate-400 uppercase"
                    style={{ left: `${m.col * 22}px` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-0">
                {/* Weekday labels */}
                <div className="flex flex-col mr-1.5 w-7 flex-shrink-0">
                  {A.WEEKDAY_NAMES.map((w, i) => (
                    <span key={w} className="h-[22px] flex items-center text-[9px] font-black text-slate-400 uppercase">
                      {i % 2 === 0 ? w : ''}
                    </span>
                  ))}
                </div>
                {/* Grid */}
                <div className="flex gap-[4px]">
                  {heatmap.weeks.map((col, ci) => (
                    <div key={ci} className="flex flex-col gap-[4px]">
                      {col.map((cell) => {
                        const boosted = heatmap.boostDates.has(cell.iso);
                        const feat = !boosted && heatmap.featuredDates.has(cell.iso);
                        const susp = !boosted && !feat && heatmap.suspectedDates.has(cell.iso);
                        return (
                          <div
                            key={cell.iso}
                            title={
                              cell.inLog
                                ? `${cell.iso} — ${
                                    cell.isBaseline
                                      ? 'baseline (first logged day)'
                                      : cell.gain !== null
                                      ? `+${cell.gain.toLocaleString()} ${heatMetric}`
                                      : 'no gain computable'
                                  }${
                                    boosted
                                      ? ' · paid boost window'
                                      : feat
                                      ? ' · featured window'
                                      : susp
                                      ? ' · detected spike'
                                      : ''
                                  }`
                                : cell.iso + ' — before tracking started'
                            }
                            className={`w-[18px] h-[18px] rounded-[4px] transition-transform hover:scale-125 ${
                              cell.isBaseline ? 'border border-dashed border-slate-400' : ''
                            } ${
                              boosted
                                ? 'ring-2 ring-pink-400 ring-offset-1'
                                : feat
                                ? 'ring-2 ring-indigo-400 ring-offset-1'
                                : susp
                                ? 'ring-2 ring-amber-400 ring-offset-1'
                                : ''
                            }`}
                            style={{ background: heatColor(cell.gain, cell.inLog) }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              Less
              {[0.08, 0.3, 0.55, 0.8, 1].map((a, i) => (
                <span key={i} className="w-3.5 h-3.5 rounded-[3px]" style={{ background: `rgba(234,76,137,${a})` }} />
              ))}
              More
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[3px] border border-dashed border-slate-400 bg-slate-100" /> baseline day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[3px] ring-2 ring-pink-400 bg-pink-100" /> paid boost
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[3px] ring-2 ring-indigo-400 bg-indigo-50" /> featured
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[3px] ring-2 ring-amber-400 bg-amber-50" /> detected spike
            </span>
          </div>
        </div>
      </section>

      {/* ===================== LIFECYCLE + MOMENTUM ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Shot lifecycle */}
        <div className={`${CARD} p-6`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            <Activity className="w-4 h-4 text-slate-400" />
            Shot Lifecycle <InfoTip k="lifecycle" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Average views a shot earns per day, grouped by how old it was that day
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycle} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v: any) => [Number(v).toLocaleString() + ' views/day', 'Average']}
                  labelFormatter={(label: any) => {
                    const row = lifecycle.find((l) => l.name === label);
                    return `Age ${label} · ${row?.shots ?? 0} shots · ${row?.observations ?? 0} shot-days`;
                  }}
                />
                <Bar dataKey="AvgDaily" name="Avg views/day" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {lifecycle.map((l, i) => {
                    const max = Math.max(...lifecycle.map((x) => x.AvgDaily));
                    return (
                      <Cell key={i} fill="#3B82F6" fillOpacity={l.AvgDaily === max && max > 0 ? 1 : 0.45} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2.5 leading-relaxed">
            A steep drop after the first week means reach depends on the launch moment; a flat curve means older work
            keeps pulling traffic. Use it to decide whether to post more often or to invest in fewer, stronger shots.
          </p>
        </div>

        {/* Momentum */}
        <div className={`${CARD} p-6`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            <Gauge className="w-4 h-4 text-slate-400" />
            Momentum <InfoTip k="momentum" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            {momentum.enough
              ? `Recent ${momentum.recentDays} days vs previous ${momentum.olderDays} days, per shot`
              : 'Needs a longer range to compare two halves'}
          </p>

          {!momentum.enough ? (
            <p className="text-xs text-slate-400 font-medium py-12 text-center">
              Select a wider range (at least 4 usable days) to compare momentum.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Accelerating
                </p>
                <div className="space-y-1.5">
                  {rising.map((r) => (
                    <a
                      key={r.shot.url}
                      href={r.shot.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 group"
                    >
                      <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-pink-600 transition-colors">
                        {A.shotTitle(r.shot)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap flex-shrink-0">
                        {r.prevRate} → <span className="text-emerald-600">{r.nowRate}</span>
                        <span className="text-slate-400">/day</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Cooling down
                </p>
                <div className="space-y-1.5">
                  {cooling.map((r) => (
                    <a
                      key={r.shot.url}
                      href={r.shot.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 group"
                    >
                      <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-pink-600 transition-colors">
                        {A.shotTitle(r.shot)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap flex-shrink-0">
                        {r.prevRate} → <span className="text-slate-700">{r.nowRate}</span>
                        <span className="text-slate-400">/day</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===================== CONCENTRATION + TAG MATRIX ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Portfolio concentration (Pareto) */}
        <div className={`${CARD} p-6`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Portfolio Concentration <InfoTip k="concentration" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Share of total views delivered by the top X% of shots
                {paretoOrganic && pareto.hasBoosts && ' · promoted shots excluded'}
              </p>
            </div>
            {pareto.hasBoosts && (
              <Seg>
                <SegBtn active={!paretoOrganic} onClick={() => setParetoOrganic(false)}>
                  All
                </SegBtn>
                <SegBtn active={paretoOrganic} onClick={() => setParetoOrganic(true)}>
                  Organic only
                </SegBtn>
              </Seg>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top 3 shots deliver</p>
              <p className="text-xl font-black text-slate-800 font-mono mt-0.5">{activePareto.top3.toFixed(1)}%</p>
              {pareto.hasBoosts && (
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  organic: <span className="font-mono text-slate-600">{pareto.organic.top3.toFixed(1)}%</span>
                  {Math.abs(paretoDelta) >= 0.1 && (
                    <span className={`ml-1 font-mono ${paretoDelta > 0 ? 'text-pink-500' : 'text-emerald-600'}`}>
                      ({paretoDelta > 0 ? '+' : ''}{paretoDelta.toFixed(1)} from promotion)
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top 10 shots deliver</p>
              <p className="text-xl font-black text-slate-800 font-mono mt-0.5">{activePareto.top10.toFixed(1)}%</p>
              {pareto.hasBoosts && (
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  organic: <span className="font-mono text-slate-600">{pareto.organic.top10.toFixed(1)}%</span>
                </p>
              )}
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activePareto.curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  label={{ value: '% of shots (best first)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94A3B8', fontWeight: 700 }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v: any) => [`${v}% of views`, 'Cumulative share']}
                  labelFormatter={(l: any) => `Top ${l}% of shots`}
                />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#CBD5E1" strokeDasharray="5 4" />
                <Area type="monotone" dataKey="y" stroke="#EA4C89" strokeWidth={2.5} fill="#EA4C89" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
            The dashed diagonal = perfectly even distribution. The further the pink curve bows toward the top-left,
            the more the portfolio depends on a few hero shots.
          </p>
        </div>

        {/* Tag performance matrix */}
        <div className={`${CARD} p-6`}>
          <div className="mb-2">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Tag Performance Matrix <InfoTip k="tagMatrix" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Reach (avg views/shot) × conversion (likes per 100 views) · bubble = shots using the tag
            </p>
          </div>

          {tagMatrix.rows.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium py-10 text-center">Not enough tagged shots in this selection.</p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="avgViews"
                      type="number"
                      name="Avg views / shot"
                      tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                    />
                    <YAxis
                      dataKey="likeRate"
                      type="number"
                      name="Likes per 100 views"
                      unit="%"
                      tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ZAxis dataKey="shots" range={[70, 420]} name="Shots" />
                    <ReferenceLine x={tagMatrix.avgX} stroke="#CBD5E1" strokeDasharray="4 4" />
                    <ReferenceLine y={tagMatrix.avgY} stroke="#CBD5E1" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={chartTooltipStyle as any} className="p-2.5">
                            <p className="font-extrabold text-slate-800 text-[11px]">#{d.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              {d.shots} shots · {d.totalViews.toLocaleString()} total views
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {d.avgViews.toLocaleString()} avg views · {d.likeRate}% like rate
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={tagMatrix.rows} fill="#EA4C89">
                      {tagMatrix.rows.map((r, i) => {
                        const golden = r.avgViews >= tagMatrix.avgX && r.likeRate >= tagMatrix.avgY;
                        return <Cell key={i} fill={golden ? '#EA4C89' : '#94A3B8'} fillOpacity={golden ? 0.85 : 0.5} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold mt-1 text-right">
                pink bubbles = above-average reach <span className="font-black">and</span> conversion (golden tags)
              </p>

              {/* Top tags mini table: shots + total views per tag */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Top tags by total views
                </p>
                <div className="space-y-1.5">
                  {[...tagMatrix.rows]
                    .sort((a, b) => b.totalViews - a.totalViews)
                    .slice(0, 6)
                    .map((t) => {
                      const max = Math.max(...tagMatrix.rows.map((r) => r.totalViews));
                      return (
                        <div key={t.name} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-600 w-36 truncate flex-shrink-0">#{t.name}</span>
                          <div className="flex-1 stat-line">
                            <div className="stat-progress" style={{ width: `${(t.totalViews / max) * 100}%` }} />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap flex-shrink-0">
                            {t.totalViews.toLocaleString()} v · {t.shots} shots
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===================== PROJECT MATRIX + VIEWS COMPOSITION (restored) ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${CARD} p-6 xl:col-span-2`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            Project Performance Matrix <InfoTip k="projectMatrix" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Each bubble is a client project · X: avg views per shot · Y: engagement rate · size: number of shots
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 25, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis
                  type="number"
                  dataKey="avgViews"
                  name="Avg views / shot"
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  tickFormatter={compact}
                />
                <YAxis
                  type="number"
                  dataKey="engRate"
                  name="Engagement"
                  unit="%"
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis type="number" dataKey="shots" range={[120, 700]} name="Shots" />
                <ReferenceLine x={avgOfAvgViews} stroke="#CBD5E1" strokeDasharray="4 4" />
                <ReferenceLine y={avgEngRate} stroke="#CBD5E1" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }: any) => {
                    const d = payload && payload[0] && payload[0].payload;
                    if (!d) return null;
                    return (
                      <div style={chartTooltipStyle as any} className="p-2.5">
                        <p className="font-black text-slate-800 mb-1 flex items-center gap-1.5 text-[11px]">
                          <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          {d.name}
                        </p>
                        <p className="text-slate-500 font-semibold text-[10px]">
                          {d.shots} shots · {d.views.toLocaleString()} total views
                        </p>
                        <p className="text-slate-500 font-semibold text-[10px]">
                          {d.avgViews.toLocaleString()} avg/shot · {d.engRate}% engagement
                        </p>
                        <p className="text-emerald-600 font-bold mt-0.5 text-[10px]">
                          +{d.gained.toLocaleString()} views in {rangeLabel}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter data={projectRows} isAnimationActive={false}>
                  {projectRows.map((r) => (
                    <Cell key={r.name} fill={r.color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-100">
            {projectRows.map((r) => (
              <span key={r.name} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                {r.name}
              </span>
            ))}
            <span className="text-[9px] text-slate-400 font-semibold ml-auto">
              top-right quadrant = star projects (above-average reach and engagement)
            </span>
          </div>
        </div>

        {/* Top tags ROI radar */}
        <div className={`${CARD} p-6 flex flex-col`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            Top Tags ROI <InfoTip k="tagRadar" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-2">Highest-yielding tags by likes earned</p>
          {tagRadar.length < 3 ? (
            <p className="flex-1 flex items-center justify-center text-xs text-slate-400 font-medium min-h-[220px]">
              Needs at least 3 tags used on 2+ shots.
            </p>
          ) : (
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={tagRadar}>
                  <PolarGrid stroke={C.grid} />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: C.label, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar name="Likes" dataKey="Likes" stroke={C.likes} fill={C.likes} fillOpacity={0.4} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                    labelFormatter={(l: any) => {
                      const row = tagRadar.find((t) => t.name === l);
                      return row ? `#${row.full} · ${row.shots} shots` : l;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ===================== VIEWS COMPOSITION BY PROJECT (restored) ===================== */}
      <div className={`${CARD} p-6`}>
        <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
          Views Composition by Project <InfoTip k="projectStack" />
        </h3>
        <p className="text-xs text-slate-400 font-medium mb-4">
          Which projects carry the portfolio&rsquo;s total views over time — stacked, {rangeLabel}
        </p>
        {projectStack.rows.length < 2 ? (
          <div className="h-56 flex items-center justify-center text-xs text-slate-400 font-medium text-center px-6">
            This chart needs 2+ logged days in the selected range — it fills in as daily syncs accumulate.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectStack.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compact}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                />
                <Legend {...legendProps} />
                {projectStack.names.map((n) => (
                  <Area
                    key={n}
                    type="monotone"
                    dataKey={n}
                    stackId="1"
                    stroke={projectStack.colorMap[n]}
                    strokeWidth={1.5}
                    fill={projectStack.colorMap[n]}
                    fillOpacity={0.55}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ===================== CADENCE + VELOCITY (restored) ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={`${CARD} p-6`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            Posting Cadence vs Performance <InfoTip k="cadence" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Shots published per month vs the average views each one earned
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={postingCadence} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compact}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={chartTooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                />
                <Legend {...legendProps} />
                <Bar
                  yAxisId="left"
                  dataKey="Posts"
                  name="Posts published"
                  fill={C.saves}
                  fillOpacity={0.5}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="AvgViews"
                  name="Avg views / post"
                  stroke={C.views}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
            Answers &ldquo;does posting more often pay off?&rdquo; — compare cadence against per-post returns.
          </p>
        </div>

        <div className={`${CARD} p-6`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Period Growth Velocity <InfoTip k="velocity" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Net acquisition per {rangeLabel}-sized period
              </p>
            </div>
            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md border border-violet-100 flex-shrink-0">
              Momentum
            </span>
          </div>
          {velocity.length < 2 ? (
            <p className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium text-center px-6">
              Only one period of data so far — this chart compares consecutive periods of equal length.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={velocity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: C.label, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={{ stroke: C.axis }}
                  />
                  <YAxis
                    yAxisId="v"
                    tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={compact}
                  />
                  <YAxis
                    yAxisId="l"
                    orientation="right"
                    tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={chartTooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                  />
                  <Legend {...legendProps} />
                  <Bar
                    yAxisId="v"
                    dataKey="NewViews"
                    name="New views"
                    fill={C.views}
                    fillOpacity={0.75}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={44}
                  />
                  <Bar
                    yAxisId="l"
                    dataKey="NewLikes"
                    name="New likes"
                    fill={C.likes}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={44}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ===================== SHOT PERFORMANCE MATRIX (restored) ===================== */}
      <div className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Shot Performance Matrix <InfoTip k="shotMatrix" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Every shot plotted by reach and response — outliers above the crowd are the viral ones
            </p>
          </div>
          <Seg>
            <SegBtn active={shotMatrixAxis === 'likes'} onClick={() => setShotMatrixAxis('likes')}>
              Likes
            </SegBtn>
            <SegBtn active={shotMatrixAxis === 'saves'} onClick={() => setShotMatrixAxis('saves')}>
              Saves
            </SegBtn>
          </Seg>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis
                type="number"
                dataKey="views"
                name="Views"
                tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: C.axis }}
                tickFormatter={compact}
              />
              <YAxis
                type="number"
                dataKey={shotMatrixAxis}
                name={shotMatrixAxis === 'likes' ? 'Likes' : 'Saves'}
                tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />
              <ZAxis type="number" range={[60, 260]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }: any) => {
                  const d = payload && payload[0] && payload[0].payload;
                  if (!d) return null;
                  return (
                    <div style={chartTooltipStyle as any} className="p-2.5 max-w-[240px]">
                      <p className="font-extrabold text-slate-800 text-[11px] leading-snug">{d.title}</p>
                      <p className="text-slate-500 font-semibold text-[10px] mt-1">
                        {d.views.toLocaleString()} views · {d.likes.toLocaleString()} likes ·{' '}
                        {d.saves.toLocaleString()} saves
                      </p>
                      <p className="text-slate-400 font-semibold text-[10px]">{d.project}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={shotMatrix} isAnimationActive={false}>
                {shotMatrix.map((d) => (
                  <Cell
                    key={d.url}
                    fill={d.boosted ? C.paid : C.views}
                    fillOpacity={d.boosted ? 0.85 : 0.55}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
          Points far above the general cloud converted unusually well for their reach; points far to the right with a
          low height got traffic without response.
          {boostedUrls.size > 0 && ' Pink points are registered promotions.'}
        </p>
      </div>

      {/* ===================== TOP SHOTS ===================== */}
      <div className={`${CARD} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Top Shots <InfoTip k="topShots" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {topShotsMode === 'growth' ? `Ranked by growth inside ${rangeLabel}` : 'Ranked by all-time totals'}
              {exclusion === 'paid' && ' · paid excluded'}
              {exclusion === 'all' && ' · organic only'}
            </p>
          </div>
          <Seg>
            <SegBtn active={topShotsMode === 'growth'} onClick={() => setTopShotsMode('growth')}>
              Growth
            </SegBtn>
            <SegBtn active={topShotsMode === 'total'} onClick={() => setTopShotsMode('total')}>
              Total
            </SegBtn>
          </Seg>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
          {A.METRIC_KEYS.map((metric) => {
            const meta = METRIC_META[metric];
            const list = topShotsFor(metric);
            const maxVal = Math.max(1, ...list.map((x) => (topShotsMode === 'growth' ? x.growth[metric] : x.totals[metric])));
            return (
              <div key={metric} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40">
                <p className="text-[11px] font-black uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: meta.color }}>
                  <meta.Icon className="w-3.5 h-3.5" /> {meta.label}
                </p>
                <div className="space-y-2.5">
                  {list.map((x, i) => {
                    const val = topShotsMode === 'growth' ? x.growth[metric] : x.totals[metric];
                    return (
                      <a
                        key={x.shot.url}
                        href={x.shot.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 group"
                      >
                        <span className="text-[10px] font-black text-slate-300 w-4 flex-shrink-0">{i + 1}</span>
                        {x.shot.imageUrl ? (
                          <img
                            src={x.shot.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-9 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-7 rounded-md bg-slate-200 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-pink-600 transition-colors flex items-center gap-1">
                            {A.shotTitle(x.shot)}
                            {x.paidInRange && (
                              <Zap className="w-3 h-3 text-pink-500 flex-shrink-0" aria-label="Paid boost overlaps this range" />
                            )}
                            {x.featuredInRange && (
                              <Star className="w-3 h-3 text-indigo-500 flex-shrink-0" aria-label="Featured in this range" />
                            )}
                          </p>
                          <div className="stat-line mt-1">
                            <div className="stat-progress" style={{ width: `${(val / maxVal) * 100}%`, background: meta.color }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-black text-slate-700 whitespace-nowrap flex-shrink-0">
                          {topShotsMode === 'growth' ? '+' : ''}
                          {val.toLocaleString()}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================== PROJECTS + ENGAGEMENT MIX ===================== */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${CARD} p-6 xl:col-span-2`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            Project Performance <InfoTip k="projects" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            Clients/projects parsed from shot titles · &ldquo;Gained&rdquo; = views earned in {rangeLabel}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 font-bold text-[10px] uppercase tracking-wider font-mono border-b border-slate-100">
                <tr>
                  <th className="py-2.5 pr-3">Project</th>
                  <th className="py-2.5 px-3 text-center">Shots</th>
                  <th className="py-2.5 px-3 text-right">Views</th>
                  <th className="py-2.5 px-3 text-right">Avg / shot</th>
                  <th className="py-2.5 px-3 text-right">Eng. rate</th>
                  <th className="py-2.5 pl-3 w-44">Gained ({rangeLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projectRows.map((r) => (
                  <tr key={r.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                        {r.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs font-mono font-bold text-slate-500">{r.shots}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-slate-700">
                      {r.views.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-mono font-semibold text-slate-500">
                      {r.avgViews.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-emerald-600">{r.engRate}%</td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 stat-line">
                          <div className="stat-progress" style={{ width: `${(r.gained / maxProjGained) * 100}%`, background: r.color }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">
                          +{r.gained.toLocaleString()}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Engagement mix donut */}
        <div className={`${CARD} p-6 flex flex-col`}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Engagement Mix <InfoTip k="engagementMix" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {mixScope === 'range' ? `Interactions gained in ${rangeLabel}` : 'All-time interaction totals'}
              </p>
            </div>
            <Seg>
              <SegBtn active={mixScope === 'range'} onClick={() => setMixScope('range')}>
                Range
              </SegBtn>
              <SegBtn active={mixScope === 'all'} onClick={() => setMixScope('all')}>
                All-time
              </SegBtn>
            </Seg>
          </div>

          {totalInteractions === 0 ? (
            <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center">
              <p className="text-xs font-bold text-slate-500">No interactions in this window</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1 max-w-[220px] leading-relaxed">
                Likes, saves and comments were flat across {rangeLabel}. Switch to All-time to see the portfolio
                totals.
              </p>
            </div>
          ) : (
            <>
              <div className="h-52 relative mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixSlices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="88%"
                      paddingAngle={mixSlices.length > 1 ? 3 : 0}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {mixSlices.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={tooltipLabelStyle}
                      formatter={(v: any, n: any) => [
                        `${Number(v).toLocaleString()} (${((Number(v) / totalInteractions) * 100).toFixed(1)}%)`,
                        n,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800 font-mono leading-none">
                    {mixScope === 'range' ? '+' : ''}
                    {compact(totalInteractions)}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                    interactions
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {engagementMix.map((e) => {
                  const pct = totalInteractions > 0 ? (e.value / totalInteractions) * 100 : 0;
                  return (
                    <div key={e.name}>
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                          {e.name}
                        </span>
                        <span className="font-mono text-slate-700">
                          {e.value.toLocaleString()}
                          <span className="text-slate-400 ml-1.5">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="stat-line">
                        <div className="stat-progress" style={{ width: `${pct}%`, background: e.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

    </div>
  );
}
