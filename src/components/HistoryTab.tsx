/**
 * History tab — daily ledger with day-over-day deltas and anomaly badges.
 *
 * Answers the "why do 13th and 14th disagree?" class of question directly in
 * the UI:
 *   - baseline  : the first logged day has no previous day, so no delta exists
 *   - ⚡ spike   : aggregate view gain far above the median daily gain
 *                 (boost / feature / external traffic)
 *   - unlike    : many shots each lost exactly one like on the same day — the
 *                 signature of one account removing its likes (or being purged
 *                 by Dribbble), not a data error
 *   - short gap : consecutive logs less than ~18h apart, so the "day" covers a
 *                 partial window and its gain is naturally smaller/larger
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Info, Zap, UserMinus, Download } from 'lucide-react';
import { Shot } from '../types.ts';
import { InfoTip } from './InfoTip.tsx';
import * as A from '../analytics.ts';
import { assessDataQuality, QUALITY_LABEL } from '../dataQuality.ts';

interface Row {
  date: string;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shotsCount: number;
  dViews: number | null;
  dLikes: number | null;
  dSaves: number | null;
  dComments: number | null;
  engagementRate: string;
  scrapedAt: number | null;
  hoursSincePrev: number | null;
  badges: { kind: 'baseline' | 'spike' | 'unlike' | 'shortgap' | 'staggered'; label: string; title: string }[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function HistoryTab({ shots }: { shots: Shot[] }) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const dates = A.unionDates(shots);
    if (dates.length === 0) return [];
    const totals = A.aggregateTotals(shots, dates);
    const quality = assessDataQuality(shots, dates);
    const matrix = A.buildGainMatrix(shots, dates, quality.excludedDates);

    // earliest scrape timestamp logged on each date (when the run actually ran)
    const tsByDate = new Map<string, number>();
    shots.forEach((s) => {
      (Array.isArray(s.history) ? s.history : []).forEach((h: any) => {
        if (!h || !h.date || !h.timestamp) return;
        const cur = tsByDate.get(h.date);
        if (cur === undefined || h.timestamp < cur) tsByDate.set(h.date, h.timestamp);
      });
    });

    // how many shots lost exactly one like on each date (mass-unlike signature)
    const minusOneCount = new Array(dates.length).fill(0);
    matrix.perShot.forEach((g) => {
      g.raw.likes.forEach((v, i) => {
        if (v === -1) minusOneCount[i] += 1;
      });
    });

    const positiveGains = matrix.agg.views.slice(1).filter((v) => v > 0);
    const medGain = median(positiveGains);

    return dates.map((date, i) => {
      const t = totals[i];
      const prev = i > 0 ? totals[i - 1] : null;
      const ts = tsByDate.get(date) ?? null;
      const prevTs = i > 0 ? tsByDate.get(dates[i - 1]) ?? null : null;
      const hoursSincePrev = ts !== null && prevTs !== null ? (ts - prevTs) / 3600000 : null;

      const q = quality.byDate.get(date);
      const badges: Row['badges'] = [];

      if (q && q.quality === 'staggered') {
        badges.push({
          kind: 'staggered',
          label: QUALITY_LABEL.staggered,
          title: q.reason + ' Its change is excluded from every growth chart.',
        });
      } else if (q && q.quality === 'short-window') {
        badges.push({
          kind: 'shortgap',
          label: QUALITY_LABEL['short-window'],
          title: q.reason + ' Its change is excluded from every growth chart.',
        });
      } else if (q && q.quality === 'baseline') {
        badges.push({
          kind: 'baseline',
          label: 'baseline',
          title: q.reason,
        });
      }

      if (i === 0) {
        // handled above
      } else if (q && q.usableDelta) {
        const gain = matrix.agg.views[i];
        if (medGain > 0 && gain > medGain * 3 && gain > 500) {
          badges.push({
            kind: 'spike',
            label: 'unusual growth',
            title: `Views grew ${(gain / medGain).toFixed(1)}× the typical daily rate (${Math.round(medGain).toLocaleString()}/day). Common causes: a Dribbble boost, being featured, or an external share. Register it in the Boost Registry on the Analysis tab so charts can account for it.`,
          });
        }
        if (minusOneCount[i] >= 10) {
          badges.push({
            kind: 'unlike',
            label: `${minusOneCount[i]} shots −1 like`,
            title: `${minusOneCount[i]} different shots each lost exactly one like on this day. That pattern means a single account removed its likes (or was purged by Dribbble) — the data is correct, the likes really went away.`,
          });
        }
      }

      return {
        date,
        views: t.views,
        likes: t.likes,
        saves: t.saves,
        comments: t.comments,
        shotsCount: t.shotsCount,
        // Deltas are only shown for days that survive the quality gate; an
        // untrustworthy day would otherwise display a large fake change.
        dViews: prev && q?.usableDelta ? t.views - prev.views : null,
        dLikes: prev && q?.usableDelta ? t.likes - prev.likes : null,
        dSaves: prev && q?.usableDelta ? t.saves - prev.saves : null,
        dComments: prev && q?.usableDelta ? t.comments - prev.comments : null,
        engagementRate: t.views ? ((t.likes / t.views) * 100).toFixed(2) + '%' : '0%',
        scrapedAt: ts,
        hoursSincePrev,
        badges,
      };
    });
  }, [shots]);

  const visible = showAll ? rows : rows.slice(-30);
  const reversed = [...visible].reverse();

  const exportCsv = () => {
    const headers = ['Date', 'Scraped at (UTC)', 'Active shots', 'Views', 'ΔViews', 'Likes', 'ΔLikes', 'Saves', 'ΔSaves', 'Comments', 'ΔComments', 'Engagement rate', 'Notes'];
    const lines = [...rows].reverse().map((r) => [
      r.date,
      r.scrapedAt ? new Date(r.scrapedAt).toISOString().slice(0, 16).replace('T', ' ') : '',
      r.shotsCount,
      r.views,
      r.dViews ?? '',
      r.likes,
      r.dLikes ?? '',
      r.saves,
      r.dSaves ?? '',
      r.comments,
      r.dComments ?? '',
      r.engagementRate,
      `"${r.badges.map((b) => b.label).join('; ')}"`,
    ]);
    const csv = [headers.join(','), ...lines.map((l) => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dribbble_daily_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const Delta = ({ v, color }: { v: number | null; color: string }) => {
    if (v === null) return <span className="text-[10px] font-semibold text-slate-300">—</span>;
    if (v === 0) return <span className="text-[10px] font-mono font-semibold text-slate-300">0</span>;
    return (
      <span className={`text-[10px] font-mono font-bold ${v > 0 ? color : 'text-red-500'}`}>
        {v > 0 ? '+' : ''}
        {v.toLocaleString()}
      </span>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
        <p className="text-sm font-bold text-slate-600">No daily log yet.</p>
        <p className="text-xs text-slate-400 mt-1">Run a sync to start recording history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Daily Historical Ledger <InfoTip k="historyLedger" />
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Totals per logged day with day-over-day change · {rows.length} days recorded
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 30 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {showAll ? 'Show last 30' : `Show all ${rows.length}`}
              </button>
            )}
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-slate-400" /> baseline = first log, no delta possible
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-500" /> unusual growth = possible boost / feature
          </span>
          <span className="flex items-center gap-1.5">
            <UserMinus className="w-3 h-3 text-violet-500" /> mass unlike = one account removed its likes
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-sky-500" /> partial window / staggered capture = excluded from growth math
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-3 py-3.5 text-center">Shots</th>
                <th className="px-3 py-3.5 text-right">Views</th>
                <th className="px-3 py-3.5 text-right">Likes</th>
                <th className="px-3 py-3.5 text-right">Saves</th>
                <th className="px-3 py-3.5 text-right">Comments</th>
                <th className="px-3 py-3.5 text-right">Eng. rate</th>
                <th className="px-5 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reversed.map((r) => (
                <tr
                  key={r.date}
                  className={`transition-colors font-medium ${
                    r.badges.some((b) => b.kind === 'spike')
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : r.badges.some((b) => b.kind === 'unlike')
                      ? 'bg-violet-50/30 hover:bg-violet-50/60'
                      : 'hover:bg-slate-50/40'
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <p className="text-slate-800 font-bold font-mono text-xs">{r.date}</p>
                    {r.scrapedAt && (
                      <p className="text-[10px] text-slate-400 font-mono font-semibold mt-0.5">
                        run {new Date(r.scrapedAt).toISOString().slice(11, 16)} UTC
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center text-slate-600 font-semibold font-mono text-xs">{r.shotsCount}</td>

                  <td className="px-3 py-3.5 text-right">
                    <p className="font-bold text-blue-600 font-mono text-xs">{r.views.toLocaleString()}</p>
                    <Delta v={r.dViews} color="text-emerald-600" />
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <p className="font-bold text-pink-600 font-mono text-xs">{r.likes.toLocaleString()}</p>
                    <Delta v={r.dLikes} color="text-emerald-600" />
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <p className="font-bold text-purple-600 font-mono text-xs">{r.saves.toLocaleString()}</p>
                    <Delta v={r.dSaves} color="text-emerald-600" />
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <p className="font-bold text-slate-700 font-mono text-xs">{r.comments.toLocaleString()}</p>
                    <Delta v={r.dComments} color="text-emerald-600" />
                  </td>
                  <td className="px-3 py-3.5 text-right font-bold text-emerald-600 font-mono text-xs">
                    {r.engagementRate}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {r.badges.map((b, i) => (
                        <span
                          key={i}
                          title={b.title}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border cursor-help ${
                            b.kind === 'spike'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : b.kind === 'unlike'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : b.kind === 'shortgap' || b.kind === 'staggered'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {b.kind === 'spike' && <Zap className="w-3 h-3" />}
                          {b.kind === 'unlike' && <UserMinus className="w-3 h-3" />}
                          {(b.kind === 'shortgap' || b.kind === 'staggered') && <Clock className="w-3 h-3" />}
                          {b.kind === 'baseline' && <Info className="w-3 h-3" />}
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Hover any badge for the full explanation. A dash instead of a delta means that day did not produce a
            trustworthy day-over-day change (its cumulative totals are still correct). Negative deltas are normal —
            likes and saves can be withdrawn on Dribbble, and a whole account being removed shows up as many shots
            each losing one like on the same day.
          </p>
        </div>
      </div>
    </div>
  );
}
