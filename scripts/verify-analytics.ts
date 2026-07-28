/**
 * Sanity checks for the analytics engine against the real committed snapshot.
 * Run:  npx tsx scripts/verify-analytics.ts
 */
import fs from 'fs';
import path from 'path';
import * as A from '../src/analytics.ts';
import { assessDataQuality, QUALITY_LABEL } from '../src/dataQuality.ts';
import type { Shot } from '../src/types.ts';

const shots: Shot[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'shots.json'), 'utf-8')
);
const ok = shots.filter((s) => s.status === 'ok');

let failures = 0;
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

console.log(`\nLoaded ${ok.length} ok shots\n`);

const dates = A.unionDates(ok);
console.log(`Dates: ${dates.length} (${dates[0]} → ${dates[dates.length - 1]})\n`);

const quality = assessDataQuality(ok, dates);
console.log('Data quality:');
quality.days.forEach((d) =>
  console.log(
    `  ${d.date}  ${QUALITY_LABEL[d.quality].padEnd(18)} usable=${d.usableDelta ? 'Y' : 'N'}  spread=${
      d.spreadMin !== null ? d.spreadMin.toFixed(0) + 'm' : '-'
    }  window=${d.windowHours !== null ? d.windowHours.toFixed(1) + 'h' : '-'}`
  )
);
console.log(`  baseline=${quality.baselineDate}  excluded=${quality.excludedCount}\n`);

const totals = A.aggregateTotals(ok, dates);
const matrix = A.buildGainMatrix(ok, dates, quality.excludedDates);

console.log('Daily totals and gains:');
totals.forEach((t, i) => {
  const g = matrix.agg.views[i];
  const raw = matrix.aggRaw.likes[i];
  console.log(
    `  ${t.date}  shots=${t.shotsCount}  views=${String(t.views).padStart(7)}  +${String(g).padStart(6)}  likes=${t.likes} (${raw >= 0 ? '+' : ''}${raw})`
  );
});

// --- assertions ---
check('every date carries all 70 shots', totals.every((t) => t.shotsCount === ok.length));
check(
  'totals are monotonic for views',
  totals.every((t, i) => i === 0 || t.views >= totals[i - 1].views)
);
check('baseline day has zero aggregate gain', matrix.agg.views[0] === 0);

// Sum of daily gains should equal end - start for views (monotonic metric)
const sumGains = matrix.agg.views.reduce((a, b) => a + b, 0);
const diff = totals[totals.length - 1].views - totals[0].views;
const excludedJump = totals[dates.indexOf('2026-07-14')].views - totals[0].views;
check(
  'sum(gains) == last - first, minus the excluded start-up jump',
  sumGains === diff - excludedJump,
  `${sumGains} vs ${diff - excludedJump}`
);

// The staggered first capture must be caught by the quality gate...
check('2026-07-13 flagged as staggered capture', quality.byDate.get('2026-07-13')?.quality === 'staggered');
check('2026-07-14 is the clean baseline', quality.baselineDate === '2026-07-14');
check('both start-up days excluded from deltas', quality.excludedDates.has('2026-07-13') && !quality.byDate.get('2026-07-14')?.usableDelta);

// ...so it must NOT show up as growth or as a fake boost anywhere
const i14 = dates.indexOf('2026-07-14');
check('no fake gain recorded on 2026-07-14', matrix.agg.views[i14] === 0, `got ${matrix.agg.views[i14]}`);

const anomalies = A.detectAnomalyDays(matrix);
check(
  'anomaly detection no longer fires on the start-up artifact',
  !anomalies.has('2026-07-14'),
  `flagged: ${[...anomalies].join(', ') || 'none'}`
);

// Per-shot suspected boosts
const suspected = A.detectSuspectedBoosts(ok, matrix, []);
console.log(`\nSuspected boost windows: ${suspected.length}`);
suspected.slice(0, 8).forEach((s) => {
  const t = ok.find((x) => x.url === s.shotUrl);
  console.log(`  ${s.start}→${s.end}  +${s.gained.toLocaleString()}  ${t ? A.shotTitle(t) : s.shotUrl}`);
});
check(
  'no false-positive boosts from the start-up artifact',
  suspected.every((s) => s.start !== '2026-07-14'),
  `${suspected.length} suspected total`
);

// Mass-unlike detection still works on clean days
let bestDay = '';
let bestCount = 0;
dates.forEach((d, i) => {
  if (!quality.byDate.get(d)?.usableDelta) return;
  let c = 0;
  matrix.perShot.forEach((g) => {
    if (g.raw.likes[i] === -1) c++;
  });
  if (c > bestCount) {
    bestCount = c;
    bestDay = d;
  }
});
check('mass-unlike still detectable on clean days', bestCount >= 10, `${bestCount} shots at -1 like on ${bestDay}`);

// Boost filtering
const fakeBoost = [
  {
    id: 'x',
    shotUrl: ok[0].url,
    kind: 'boost' as const,
    start: '2026-07-17',
    end: '2026-07-19',
    impressions: 10000,
    placement: '',
    note: '',
  },
];
const bg = A.boostGainByDate(matrix, fakeBoost, 'views');
const gainedWin = A.gainedInWindow(matrix, fakeBoost[0], 'views');
check('boostGainByDate zero outside window', bg[0] === 0 && bg[dates.indexOf('2026-07-15')] === 0);
check('gainedInWindow == sum of in-window boost gains', gainedWin === bg.reduce((a, b) => a + b, 0), `${gainedWin}`);

// Attribution splits must reconstruct the unfiltered aggregate
const featured = [
  {
    id: 'f',
    shotUrl: ok[1].url,
    kind: 'featured' as const,
    start: '2026-07-16',
    end: '2026-07-16',
    impressions: null,
    placement: 'Popular',
    note: '',
  },
];
const attr = A.attributionByDate(matrix, [...fakeBoost, ...featured], 'views');
const reconstructed = attr.paid.map((v, i) => v + attr.featured[i] + attr.organic[i]);
check(
  'paid + featured + organic == aggregate gain (every day)',
  reconstructed.every((v, i) => v === matrix.agg.views[i])
);
const paidTotal = attr.paid.reduce((a, b) => a + b, 0);
const featTotal = attr.featured.reduce((a, b) => a + b, 0);
console.log(`\nAttribution sample: paid=${paidTotal}, featured=${featTotal}`);
check('featured attribution non-zero for the seeded feature', featTotal > 0);

// Projects and collections
const projects = A.buildProjectMap(ok);
const counts = new Map<string, number>();
projects.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
console.log('\nProjects:', [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(', '));
check('projects parsed', counts.size >= 4);

const kw = A.keywordCollectionCounts(ok);
console.log('Keyword collections:', kw.map((k) => `${k.keyword}(${k.count})`).join(', '));
check('"System" collection found', kw.some((k) => k.keyword === 'System' && k.count >= 10));

// Excluded days must not pollute weekday buckets
const excludedInWeekday = dates.filter((d, i) => matrix.excluded[i] && matrix.agg.views[i] !== 0);
check('excluded days contribute zero to every bucket', excludedInWeekday.length === 0);

// Weekday growth sanity
const wd = A.WEEKDAY_NAMES.map((n) => ({ n, samples: 0, views: 0 }));
dates.forEach((d, i) => {
  if (i === 0) return;
  const w = A.weekdayIndex(d);
  wd[w].samples++;
  wd[w].views += matrix.agg.views[i];
});
console.log('\nWeekday growth (total views gained / days sampled):');
wd.forEach((w) => console.log(`  ${w.n}: +${w.views.toLocaleString()} over ${w.samples} day(s)`));
check('weekday buckets cover all logged deltas', wd.reduce((a, w) => a + w.samples, 0) === dates.length - 1);

console.log(`\n${failures === 0 ? '✅ All checks passed' : `❌ ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
