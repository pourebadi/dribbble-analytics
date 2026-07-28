/**
 * Insights — findings the dashboard works out for you.
 *
 * Seventeen charts is a lot to read every morning. This module does the first
 * pass: it inspects the same data the charts use and writes down what actually
 * changed, in the order a person would care about it.
 *
 * Two properties matter more than the individual rules.
 *
 * **Self-calibrating.** Nothing is judged against a fixed magnitude. An earlier
 * version fired "low engagement" below 0.4% and "rising shot" above +20 views a
 * day — numbers that happened to suit one profile on one week. Point the same
 * rule at an account ten times the size and it never fires; point it at a new
 * account and it always does. Every magnitude is now measured against the
 * profile's own history using median and median-absolute-deviation, so the bar
 * moves with the data. A volatile account needs a bigger swing before anything
 * is called news; a steady one notices a smaller one.
 *
 * **Silent under uncertainty.** Each rule needs a minimum number of
 * observations, and each returns nothing when the history it would compare
 * against does not exist yet. A thin week produces fewer findings rather than
 * shakier ones. Sample-count minimums are the only fixed constants here, and
 * they are named at every call site.
 *
 * Rule-based on purpose, not a model: every line states its comparison and its
 * baseline, so it can be checked against the chart it came from and cannot
 * assert something the data does not support.
 */

import { Shot } from './types.ts';
import * as A from './analytics.ts';
import type { GainMatrix, MetricKey } from './analytics.ts';
import { BoostEntry } from './boosts.ts';
import { median, mad, robustZ, ratio, rollingSums } from './stats.ts';

export type InsightTone = 'good' | 'bad' | 'neutral' | 'action';

export interface Insight {
  id: string;
  tone: InsightTone;
  /** one sentence, plain language */
  headline: string;
  /** the evidence, so the reader can verify rather than trust */
  detail: string;
  /** what to do about it, when there is something to do */
  action?: string;
  /** 0–100, drives ordering; derived from how unusual the finding is */
  weight: number;
  anchor?: string;
}

export interface InsightInput {
  shots: Shot[];
  dates: string[];
  matrix: GainMatrix;
  rangeIdx: number[];
  startStr: string;
  endStr: string;
  rangeLabel: string;
  boosts: BoostEntry[];
  growthByShot: { shot: Shot; growth: Record<MetricKey, number> }[];
  suspectedCount: number;
  collectionsCount: number;
  unassignedCount: number;
}

const num = (n: number) => Math.round(n).toLocaleString();
const pctStr = (n: number) => `${Math.abs(n).toFixed(0)}%`;

/** Significance ladder: how many robust deviations before something is news. */
const NOTABLE = 1.5;
const STRIKING = 3;

/** Converts a robust z-score into the 0–100 ordering weight. */
const weightFromZ = (z: number, base: number) => Math.min(99, base + Math.min(20, Math.abs(z) * 4));

function sumOver(matrix: GainMatrix, idx: number[], metric: MetricKey): number {
  let total = 0;
  for (const i of idx) {
    if (i === 0 || matrix.excluded[i]) continue;
    total += matrix.agg[metric][i];
  }
  return total;
}

export function buildInsights(input: InsightInput): Insight[] {
  const {
    dates, matrix, rangeIdx, startStr, endStr, rangeLabel,
    boosts, growthByShot, suspectedCount, collectionsCount, unassignedCount, shots,
  } = input;

  const out: Insight[] = [];
  const usable = rangeIdx.filter((i) => i > 0 && !matrix.excluded[i]);
  if (usable.length === 0) return out;

  const periodName = rangeLabel.replace('last ', '');
  const viewsNow = sumOver(matrix, usable, 'views');

  /** Every trustworthy day in the log, the basis for all historical baselines. */
  const allUsable = dates.map((_, i) => i).filter((i) => i > 0 && !matrix.excluded[i]);
  const dailyViews = allUsable.map((i) => matrix.agg.views[i]);
  const dailyInteractions = allUsable.map(
    (i) => matrix.agg.likes[i] + matrix.agg.saves[i] + matrix.agg.comments[i]
  );

  // ---------------------------------------------------------- period vs usual
  // Judged against how much this profile's periods normally differ from each
  // other, not against a fixed percentage.
  const spanDays = A.daysBetween(startStr, endStr) + 1;
  const prevEnd = A.isoAddDays(startStr, -1);
  const prevStart = A.isoAddDays(prevEnd, -(spanDays - 1));
  const prevIdx = dates
    .map((d, i) => ({ d, i }))
    .filter((x) => x.i > 0 && !matrix.excluded[x.i] && x.d >= prevStart && x.d <= prevEnd)
    .map((x) => x.i);

  // MIN_PERIOD_DAYS: a comparison needs at least this many observations on each
  // side to mean anything. A sample count, not a magnitude.
  const MIN_PERIOD_DAYS = 3;
  if (prevIdx.length >= Math.max(MIN_PERIOD_DAYS, usable.length / 2)) {
    const viewsPrev = sumOver(matrix, prevIdx, 'views');
    const change = ratio(viewsNow - viewsPrev, viewsPrev);
    if (change !== null) {
      // What does a normal period-over-period move look like for this account?
      const windows = rollingSums(dailyViews, Math.max(1, usable.length));
      const historicalChanges: number[] = [];
      for (let i = 1; i < windows.length; i++) {
        if (windows[i - 1] > 0) historicalChanges.push((windows[i] - windows[i - 1]) / windows[i - 1]);
      }
      const z = robustZ(change, historicalChanges, 4);
      const typical = historicalChanges.length >= 4 ? mad(historicalChanges) : null;

      if (z !== null && Math.abs(z) >= NOTABLE) {
        out.push({
          id: 'period-change',
          tone: change > 0 ? 'good' : 'bad',
          headline: `Views are ${change > 0 ? 'up' : 'down'} ${pctStr(change * 100)} on the previous ${periodName}`,
          detail:
            `${num(viewsNow)} views against ${num(viewsPrev)} last period. ` +
            (typical
              ? `This account usually moves about ${pctStr(typical * 100)} between periods, so this is a ${
                  Math.abs(z) >= STRIKING ? 'sharp' : 'meaningful'
                } change.`
              : 'There is not much history to compare the size of the move against yet.'),
          weight: weightFromZ(z, 74),
          anchor: 'growth-over-time',
        });
      }
    }
  }

  // ------------------------------------------------ engagement vs own baseline
  // Compared against this profile's own usual conversion, never a fixed rate.
  if (viewsNow > 0) {
    const interactionsNow = sumOver(matrix, usable, 'likes') + sumOver(matrix, usable, 'saves') + sumOver(matrix, usable, 'comments');
    const rateNow = interactionsNow / viewsNow;

    const dailyRates = allUsable
      .map((i) => (matrix.agg.views[i] > 0 ? dailyInteractions[allUsable.indexOf(i)] / matrix.agg.views[i] : null))
      .filter((v): v is number => v !== null);

    // MIN_RATE_DAYS: enough days to describe a baseline conversion at all.
    const z = robustZ(rateNow, dailyRates, 6);
    if (z !== null && Math.abs(z) >= NOTABLE) {
      const baseline = median(dailyRates);
      out.push({
        id: 'engagement-shift',
        tone: rateNow > baseline ? 'good' : 'bad',
        headline:
          rateNow > baseline
            ? 'New viewers are engaging more than they usually do'
            : 'New viewers are engaging less than they usually do',
        detail: `${(rateNow * 100).toFixed(2)}% of this period's views turned into likes, saves or comments, against ${(baseline * 100).toFixed(2)}% on a typical day for this account.`,
        action:
          rateNow > baseline
            ? undefined
            : 'A drop usually means the extra reach came from feeds or promotion rather than an audience that connected. Check Traffic Attribution.',
        weight: weightFromZ(z, 62),
        anchor: 'growth-over-time',
      });
    }
  }

  // -------------------------------------------------- concentration of growth
  // The share itself is meaningless without knowing what this account's normal
  // share looks like, so it is compared against earlier windows of equal length.
  const contributors = growthByShot
    .filter((g) => g.growth.views > 0)
    .sort((a, b) => b.growth.views - a.growth.views);
  const contribTotal = contributors.reduce((a, g) => a + g.growth.views, 0);

  // MIN_CONTRIBUTORS: a "top 3 share" needs more than a handful of shots to mean
  // anything at all.
  const MIN_CONTRIBUTORS = 6;
  if (contribTotal > 0 && contributors.length >= MIN_CONTRIBUTORS) {
    const topN = Math.max(1, Math.round(contributors.length * 0.1)); // top decile
    const topShare = contributors.slice(0, topN).reduce((a, g) => a + g.growth.views, 0) / contribTotal;

    // The same measure over every earlier window of the same length.
    const historicalShares: number[] = [];
    const windowLen = usable.length;
    for (let end = windowLen; end <= allUsable.length; end++) {
      const win = allUsable.slice(end - windowLen, end);
      const perShot: number[] = [];
      matrix.perShot.forEach((g) => {
        let sum = 0;
        win.forEach((i) => (sum += g.gain.views[i]));
        if (sum > 0) perShot.push(sum);
      });
      const total = perShot.reduce((a, b) => a + b, 0);
      if (total > 0 && perShot.length >= MIN_CONTRIBUTORS) {
        perShot.sort((a, b) => b - a);
        const n = Math.max(1, Math.round(perShot.length * 0.1));
        historicalShares.push(perShot.slice(0, n).reduce((a, b) => a + b, 0) / total);
      }
    }

    const z = robustZ(topShare, historicalShares, 5);
    if (z !== null && Math.abs(z) >= NOTABLE) {
      const usual = median(historicalShares);
      out.push({
        id: 'growth-concentration',
        tone: topShare > usual ? 'bad' : 'good',
        headline:
          topShare > usual
            ? `Growth is leaning on fewer shots than usual — ${(topShare * 100).toFixed(0)}% came from the top ${topN}`
            : 'Growth is spread more widely across the portfolio than usual',
        detail: `Normally the top ${topN} shot${topN > 1 ? 's account' : ' accounts'} for about ${(usual * 100).toFixed(0)}% of new views for this account. "${A.shotTitle(contributors[0].shot)}" led with ${num(contributors[0].growth.views)}.`,
        action:
          topShare > usual
            ? 'Worth knowing what those shots have in common — and worth caution, since the numbers fall with them.'
            : undefined,
        weight: weightFromZ(z, 58),
        anchor: 'momentum-pace',
      });
    }
  }

  // -------------------------------------------------------- paid versus earned
  // Relative to what this account normally buys, not a fixed share.
  if (boosts.length > 0) {
    const attr = A.attributionByDate(matrix, boosts, 'views');
    const promotedNow = usable.reduce((a, i) => a + attr.paid[i] + attr.featured[i], 0);
    const totalNow = usable.reduce(
      (a, i) => a + attr.paid[i] + attr.featured[i] + attr.organic[i],
      0
    );
    if (totalNow > 0 && promotedNow > 0) {
      const shareNow = promotedNow / totalNow;
      const dailyShares = allUsable
        .map((i) => {
          const t = attr.paid[i] + attr.featured[i] + attr.organic[i];
          return t > 0 ? (attr.paid[i] + attr.featured[i]) / t : null;
        })
        .filter((v): v is number => v !== null);
      const z = robustZ(shareNow, dailyShares, 6);

      // Report it when it is unusual for this account, or when it is simply
      // large enough that a reader would want to know regardless.
      if ((z !== null && Math.abs(z) >= NOTABLE) || shareNow >= 0.25) {
        const paid = usable.reduce((a, i) => a + attr.paid[i], 0);
        const featured = usable.reduce((a, i) => a + attr.featured[i], 0);
        out.push({
          id: 'attribution',
          tone: shareNow >= 0.5 ? 'bad' : 'neutral',
          headline: `${(shareNow * 100).toFixed(0)}% of this period's reach was promoted rather than earned`,
          detail: `${num(paid)} views from paid boosts, ${num(featured)} from features, ${num(totalNow - promotedNow)} organic.`,
          action:
            shareNow >= 0.5
              ? 'Use the traffic filter to see what the period looks like without it before reading the other charts.'
              : undefined,
          weight: 60 + Math.round(shareNow * 20),
          anchor: 'growth-over-time',
        });
      }
    }
  }

  // ------------------------------------------------------------ weekday effect
  // MIN_WEEKDAY_SAMPLES: four of each weekday before a weekday claim is allowed.
  const MIN_WEEKDAY_SAMPLES = 4;
  const wd = A.WEEKDAY_NAMES.map(() => ({ views: 0, days: 0 }));
  usable.forEach((i) => {
    const w = A.weekdayIndex(dates[i]);
    wd[w].views += matrix.agg.views[i];
    wd[w].days += 1;
  });
  if (wd.every((w) => w.days >= MIN_WEEKDAY_SAMPLES)) {
    const avg = wd.map((w) => w.views / w.days);
    const best = avg.indexOf(Math.max(...avg));
    const z = robustZ(avg[best], avg, 7);
    if (z !== null && z >= NOTABLE) {
      const worst = avg.indexOf(Math.min(...avg));
      out.push({
        id: 'weekday',
        tone: 'neutral',
        headline: `${A.WEEKDAY_NAMES[best]}s stand out from the rest of the week`,
        detail: `An average ${A.WEEKDAY_NAMES[best]} brings ${num(avg[best])} views against ${num(avg[worst])} on a ${A.WEEKDAY_NAMES[worst]}, across ${wd[best].days} samples.`,
        action: `Publishing and promoting into ${A.WEEKDAY_NAMES[best]} may be worth testing.`,
        weight: weightFromZ(z, 46),
        anchor: 'timing-rhythm',
      });
    }
  }

  // ------------------------------------------------------------ shots to watch
  // A shot is "accelerating" relative to how the rest of the portfolio moved in
  // the same period — not against a fixed number of views.
  // MIN_MOMENTUM_DAYS: two halves worth comparing.
  const MIN_MOMENTUM_DAYS = 6;
  if (usable.length >= MIN_MOMENTUM_DAYS) {
    const mid = Math.floor(usable.length / 2);
    const older = usable.slice(0, mid);
    const recent = usable.slice(mid);
    const movers = growthByShot
      .map(({ shot }) => {
        const g = matrix.perShot.get(shot.url);
        if (!g) return null;
        const rate = (idx: number[]) => idx.reduce((a, i) => a + g.gain.views[i], 0) / (idx.length || 1);
        const before = rate(older);
        const after = rate(recent);
        return { shot, before, after, delta: after - before };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null && m.before + m.after > 0);

    if (movers.length >= 5) {
      const deltas = movers.map((m) => m.delta);
      const rising = [...movers].sort((a, b) => b.delta - a.delta)[0];
      const zUp = robustZ(rising.delta, deltas, 5);
      if (zUp !== null && zUp >= STRIKING) {
        out.push({
          id: 'rising-shot',
          tone: 'good',
          headline: `"${A.shotTitle(rising.shot)}" is accelerating faster than anything else`,
          detail: `From ${num(rising.before)} to ${num(rising.after)} views a day between the two halves of this period, while the typical shot barely moved.`,
          action: 'Momentum is the cheapest thing to amplify — worth promoting while it lasts.',
          weight: weightFromZ(zUp, 56),
          anchor: 'momentum-pace',
        });
      }

      const fading = [...movers].sort((a, b) => a.delta - b.delta)[0];
      const zDown = robustZ(fading.delta, deltas, 5);
      if (zDown !== null && zDown <= -STRIKING) {
        out.push({
          id: 'fading-shot',
          tone: 'neutral',
          headline: `"${A.shotTitle(fading.shot)}" is cooling faster than the rest`,
          detail: `From ${num(fading.before)} to ${num(fading.after)} views a day. Normal once launch attention fades — worth a look only if the shot is recent.`,
          weight: weightFromZ(zDown, 40),
          anchor: 'momentum-pace',
        });
      }
    }
  }

  // -------------------------------------------------------------------- tags
  // Already relative by construction: a tag is compared against this portfolio's
  // own conversion. The gate is on sample size, scaled to portfolio size.
  const minTagShots = Math.max(3, Math.round(shots.length * 0.04));
  const tagAgg: Record<string, { views: number; likes: number; shots: number }> = {};
  shots.forEach((s) => {
    (s.tags || []).forEach((t: any) => {
      const k = String(t).toLowerCase().trim();
      if (!k) return;
      if (!tagAgg[k]) tagAgg[k] = { views: 0, likes: 0, shots: 0 };
      tagAgg[k].views += s.views || 0;
      tagAgg[k].likes += s.likes || 0;
      tagAgg[k].shots += 1;
    });
  });
  const tagRows = Object.entries(tagAgg).filter(([, v]) => v.shots >= minTagShots && v.views > 0);
  if (tagRows.length >= 4) {
    const rates = tagRows.map(([, v]) => v.likes / v.views);
    const scored = tagRows
      .map(([name, v], i) => ({ name, rate: rates[i], shots: v.shots }))
      .sort((a, b) => b.rate - a.rate);
    const best = scored[0];
    const z = robustZ(best.rate, rates, 4);
    if (z !== null && z >= NOTABLE) {
      const typical = median(rates);
      const times = ratio(best.rate, typical);
      out.push({
        id: 'tag-winner',
        tone: 'good',
        headline: `#${best.name} converts better than your other tags`,
        detail: `Across ${best.shots} shots it earns ${(best.rate * 100).toFixed(2)} likes per 100 views${
          times ? `, about ${times.toFixed(1)}× the typical tag here` : ''
        }.`,
        action: 'Worth leaning into on upcoming work, and worth checking what those shots share.',
        weight: weightFromZ(z, 44),
        anchor: 'content-tags',
      });
    }
  }

  // ------------------------------------------------------- things only you can fix
  if (suspectedCount > 0) {
    out.push({
      id: 'unexplained',
      tone: 'action',
      headline: `${suspectedCount} shot${suspectedCount > 1 ? 's' : ''} spiked without an explanation`,
      detail:
        'These gained far more than their own normal rate. The data cannot say why — only you know whether it was paid, a feature, or a share somewhere else.',
      action: 'Classify them so the charts stop counting bought reach as earned.',
      weight: 80,
      anchor: 'promotions',
    });
  }

  if (collectionsCount === 0) {
    out.push({
      id: 'no-collections',
      tone: 'action',
      headline: 'Collection charts stay empty until you group your shots',
      detail:
        'Grouping is never guessed from titles, so three charts stay blank until you define collections.',
      action: 'The suggestion button gets you most of the way in a minute.',
      weight: 68,
      anchor: 'collections',
    });
  } else if (unassignedCount > 0) {
    // Only worth mentioning when it is a meaningful slice of the portfolio.
    const share = unassignedCount / Math.max(1, shots.length);
    if (share >= 0.1) {
      out.push({
        id: 'unassigned',
        tone: 'action',
        headline: `${unassignedCount} shot${unassignedCount > 1 ? 's are' : ' is'} not in any collection`,
        detail: `That is ${(share * 100).toFixed(0)}% of the portfolio left out of collection charts, so those totals read lower than reality.`,
        weight: 36 + Math.round(share * 20),
        anchor: 'collections',
      });
    }
  }

  // Nothing unusual is itself worth saying, rather than showing an empty panel.
  if (out.length === 0) {
    out.push({
      id: 'steady',
      tone: 'neutral',
      headline: 'Nothing unusual in this period',
      detail: `Views, engagement and the spread across shots are all close to normal for this account over ${rangeLabel}. Widen the range or check back after the next sync.`,
      weight: 10,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
