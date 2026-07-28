/**
 * Promotions page — the dedicated management surface for paid boosts and free
 * editorial features, reachable from the sidebar.
 *
 * The registry used to live behind a button inside the Analysis tab, which made
 * it hard to find and impossible to work with at scale. This page gives it a
 * real home: register entries, review their measured impact, compare campaign
 * efficiency (CTR and views per 1k impressions), and confirm or dismiss the
 * spikes the system detected automatically.
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';
import {
  Zap,
  Star,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Eye,
  Target,
  Sparkles,
  CalendarDays,
  Hash,
  StickyNote,
  Image as ImageIcon,
} from 'lucide-react';

import { Shot } from '../types.ts';
import { InfoTip } from './InfoTip.tsx';
import { ShotPicker } from './ShotPicker.tsx';
import { DatePicker } from './DatePicker.tsx';
import { IS_STATIC } from '../api.ts';
import {
  BoostEntry,
  PromoKind,
  newBoostId,
  fetchBoosts,
  persistBoosts,
} from '../boosts.ts';
import * as A from '../analytics.ts';
import { C, compact, tooltipStyle, tooltipLabelStyle, legendProps } from '../chartTheme.ts';
import { INPUT } from '../formStyles.ts';
import { assessDataQuality } from '../dataQuality.ts';

const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';

const emptyDraft = {
  shotUrl: '',
  kind: 'boost' as PromoKind,
  start: '',
  end: '',
  impressions: '',
  placement: '',
  note: '',
};

const chartTooltipStyle = tooltipStyle;

export function PromotionsPage({ shots }: { shots: Shot[] }) {
  const validShots = useMemo(() => shots.filter((s) => s.status === 'ok'), [shots]);

  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState<BoostEntry[]>([]);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [needToken, setNeedToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [listFilter, setListFilter] = useState<'all' | PromoKind>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    let alive = true;
    fetchBoosts().then((b) => {
      if (!alive) return;
      setWorking(b);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ---- analytics context ----
  const dates = useMemo(() => A.unionDates(validShots), [validShots]);
  const quality = useMemo(() => assessDataQuality(validShots, dates), [validShots, dates]);
  const matrix = useMemo(
    () => A.buildGainMatrix(validShots, dates, quality.excludedDates),
    [validShots, dates, quality]
  );
  const suspected = useMemo(
    () => A.detectSuspectedBoosts(validShots, matrix, working).filter((s) => !dismissed.has(s.shotUrl + s.start)),
    [validShots, matrix, working, dismissed]
  );

  const projectMap = useMemo(() => A.buildProjectMap(validShots), [validShots]);
  const loggedDates = useMemo(() => new Set(dates), [dates]);
  const lastLoggedDate = dates.length ? dates[dates.length - 1] : undefined;
  const registeredUrls = useMemo(() => new Set(working.map((e) => e.shotUrl)), [working]);

  const thumbByUrl = useMemo(() => {
    const m = new Map<string, string | undefined>();
    validShots.forEach((s) => m.set(s.url, s.imageUrl));
    return m;
  }, [validShots]);

  const titleByUrl = useMemo(() => {
    const m = new Map<string, string>();
    validShots.forEach((s) => m.set(s.url, A.shotTitle(s)));
    return m;
  }, [validShots]);

  const gainedFor = (e: BoostEntry) => A.gainedInWindow(matrix, e, 'views');
  const interactionsFor = (e: BoostEntry) =>
    A.gainedInWindow(matrix, e, 'likes') +
    A.gainedInWindow(matrix, e, 'saves') +
    A.gainedInWindow(matrix, e, 'comments');

  // ---- summary ----
  const summary = useMemo(() => {
    const paid = working.filter((e) => e.kind === 'boost');
    const feat = working.filter((e) => e.kind === 'featured');
    const paidViews = paid.reduce((a, e) => a + gainedFor(e), 0);
    const featViews = feat.reduce((a, e) => a + gainedFor(e), 0);
    const impressions = paid.reduce((a, e) => a + (e.impressions || 0), 0);
    const ctr = impressions > 0 ? (paidViews / impressions) * 100 : null;
    return { paid, feat, paidViews, featViews, impressions, ctr };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, matrix]);

  // ---- campaign efficiency chart ----
  const campaignRows = useMemo(
    () =>
      working
        .map((e) => {
          const views = gainedFor(e);
          const inter = interactionsFor(e);
          return {
            id: e.id,
            name: (titleByUrl.get(e.shotUrl) || e.shotUrl).slice(0, 28),
            kind: e.kind,
            views,
            interactions: inter,
            engRate: views > 0 ? +((inter / views) * 100).toFixed(2) : 0,
            ctr: e.impressions ? +((views / e.impressions) * 100).toFixed(2) : null,
            perThousand: e.impressions ? Math.round((views / e.impressions) * 1000) : null,
          };
        })
        .sort((a, b) => b.views - a.views),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [working, matrix, titleByUrl]
  );

  // ---- mutations ----
  const addDraft = () => {
    if (!draft.shotUrl || !/^\d{4}-\d{2}-\d{2}$/.test(draft.start)) return;
    const imp = parseInt(String(draft.impressions).replace(/[,\s]/g, ''), 10);
    const entry: BoostEntry = {
      id: newBoostId(),
      shotUrl: draft.shotUrl,
      kind: draft.kind,
      start: draft.start,
      end: /^\d{4}-\d{2}-\d{2}$/.test(draft.end) ? draft.end : null,
      impressions: draft.kind === 'boost' && Number.isFinite(imp) && imp > 0 ? imp : null,
      placement: draft.kind === 'featured' ? draft.placement.trim() : '',
      note: draft.note.trim(),
    };
    setWorking([entry, ...working].sort((a, b) => (a.start < b.start ? 1 : -1)));
    setDraft({ ...emptyDraft, kind: draft.kind });
    setDirty(true);
    setStatus(null);
  };

  const removeEntry = (id: string) => {
    setWorking(working.filter((e) => e.id !== id));
    setDirty(true);
    setStatus(null);
  };

  const doSave = async (tokenOverride?: string) => {
    setSaving(true);
    setStatus(null);
    const res = await persistBoosts(working, tokenOverride);
    setSaving(false);
    if (res.needToken) {
      setNeedToken(true);
      setStatus({ ok: false, message: res.message });
      return;
    }
    setNeedToken(false);
    setStatus({ ok: res.ok, message: res.message });
    if (res.ok) {
      setDirty(false);
    }
  };

  const inputCls = INPUT;

  const visibleList = working.filter((e) => listFilter === 'all' || e.kind === listFilter);

  return (
    <div className="space-y-6">
      {/* ============ SUMMARY ============ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            key: 'promoPaid',
            label: 'Paid campaigns',
            Icon: Zap,
            tone: 'text-pink-500 bg-pink-50',
            accent: C.paid,
            value: String(summary.paid.length),
            sub: `+${summary.paidViews.toLocaleString()} views measured in-window`,
          },
          {
            key: 'promoFeatured',
            label: 'Features',
            Icon: Star,
            tone: 'text-indigo-500 bg-indigo-50',
            accent: C.featured,
            value: String(summary.feat.length),
            sub: `+${summary.featViews.toLocaleString()} views measured in-window`,
          },
          {
            key: 'promoImpressions',
            label: 'Impressions bought',
            Icon: Eye,
            tone: 'text-blue-500 bg-blue-50',
            accent: C.views,
            value: summary.impressions > 0 ? compact(summary.impressions) : '—',
            sub: summary.impressions > 0 ? 'across all paid campaigns' : 'add impressions to unlock CTR',
          },
          {
            key: 'promoCtr',
            label: 'Blended CTR',
            Icon: Target,
            tone: 'text-emerald-500 bg-emerald-50',
            accent: C.organic,
            value: summary.ctr !== null ? summary.ctr.toFixed(2) + '%' : '—',
            sub:
              summary.ctr !== null
                ? `${Math.round((summary.paidViews / summary.impressions) * 1000)} views per 1k impressions`
                : 'views gained ÷ impressions bought',
          },
        ].map(({ key, label, Icon, tone, accent, value, sub }) => (
          <div key={key} className={`${CARD} p-5 relative overflow-hidden`}>
            <span
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }}
            />
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-xl ${tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                {label} <InfoTip k={key} />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 font-mono tracking-tight">{value}</h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5 leading-snug">{sub}</p>
          </div>
        ))}
      </section>

      {/* ============ DETECTED SPIKES ============ */}
      {loaded && suspected.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-100">
            <p className="text-sm font-extrabold text-amber-900 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              {suspected.length} unexplained spike{suspected.length > 1 ? 's' : ''} detected
              <InfoTip k="promoDetected" />
            </p>
          </div>
          <div className="p-5">
          <p className="text-[11px] text-amber-700 font-medium mb-3.5 leading-relaxed">
            These shots suddenly gained far more views than usual. Dribbble does not say why, so tell us: was it a boost you paid for, free exposure from Dribbble, or just organic?
          </p>
          <div className="space-y-1.5">
            {suspected.slice(0, 8).map((s) => {
              const key = s.shotUrl + s.start;
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2.5">
                    {thumbByUrl.get(s.shotUrl) ? (
                      <img
                        key={thumbByUrl.get(s.shotUrl)}
                        src={thumbByUrl.get(s.shotUrl)}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-10 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-8 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">
                      {titleByUrl.get(s.shotUrl) || s.shotUrl}
                    </p>
                    <p className="text-[10px] text-amber-700 font-mono font-semibold mt-0.5">
                      {s.start}
                      {s.end !== s.start ? ` → ${s.end}` : ''} · +{s.gained.toLocaleString()} views · peak +
                      {s.peakGain.toLocaleString()}/day
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() =>
                        setDraft({
                          ...emptyDraft,
                          kind: 'boost',
                          shotUrl: s.shotUrl,
                          start: s.start,
                          end: s.end,
                          note: `Detected spike (+${s.gained.toLocaleString()} views)`,
                        })
                      }
                      className="flex items-center gap-1 text-[10px] font-bold text-pink-700 bg-pink-100 hover:bg-pink-200 border border-pink-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Paid
                    </button>
                    <button
                      onClick={() =>
                        setDraft({
                          ...emptyDraft,
                          kind: 'featured',
                          shotUrl: s.shotUrl,
                          start: s.start,
                          end: s.end,
                          note: `Detected spike (+${s.gained.toLocaleString()} views)`,
                        })
                      }
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Star className="w-3 h-3" /> Featured
                    </button>
                    <button
                      onClick={() => setDismissed(new Set([...dismissed, key]))}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Organic
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* ============ REGISTER FORM ============ */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-transparent">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
            Register a promotion <InfoTip k="boosts" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Dribbble does not show which shots were promoted, so record them here and the charts can separate paid, free and earned reach.
          </p>
        </div>
        <div className="p-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {(
            [
              {
                k: 'boost' as PromoKind,
                Icon: Zap,
                title: 'Boosted (paid)',
                sub: 'You bought impressions for this shot — it runs until the budget is spent',
                on: 'border-pink-400 bg-pink-50 text-pink-700 ring-2 ring-pink-100',
              },
              {
                k: 'featured' as PromoKind,
                Icon: Star,
                title: 'Featured (free)',
                sub: 'Dribbble surfaced it for free — Popular, or a category spotlight',
                on: 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100',
              },
            ] as const
          ).map(({ k, Icon, title, sub, on }) => (
            <button
              key={k}
              type="button"
              onClick={() => setDraft({ ...draft, kind: k })}
              className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                draft.kind === k
                  ? on + ' shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <span className="block text-[12px] font-extrabold leading-tight">{title}</span>
                <span className="block text-[10px] font-semibold opacity-75 leading-snug mt-1">{sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <ImageIcon className="w-3 h-3" /> Shot
            </span>
            <ShotPicker
              shots={validShots}
              value={draft.shotUrl}
              onChange={(url) => setDraft({ ...draft, shotUrl: url })}
              projectOf={(url) => projectMap.get(url) || ''}
              disabledUrls={registeredUrls}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <CalendarDays className="w-3 h-3" /> Start date
            </span>
            <DatePicker
              value={draft.start}
              onChange={(iso) => setDraft({ ...draft, start: iso })}
              max={lastLoggedDate}
              availableDates={loggedDates}
              placeholder="Pick the start day"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <CalendarDays className="w-3 h-3" /> End date
              <span className="normal-case text-slate-400 font-semibold">(blank = running)</span>
            </span>
            <DatePicker
              value={draft.end}
              onChange={(iso) => setDraft({ ...draft, end: iso })}
              min={draft.start || undefined}
              max={lastLoggedDate}
              availableDates={loggedDates}
              placeholder="Still running"
              clearable
              clearLabel="Mark as still running"
            />
          </label>
          {draft.kind === 'boost' ? (
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Hash className="w-3 h-3" /> Impressions
                <span className="normal-case text-slate-400 font-semibold">(unlocks CTR)</span>
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 10,000"
                value={draft.impressions}
                onChange={(e) => setDraft({ ...draft, impressions: e.target.value })}
                className={inputCls}
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Star className="w-3 h-3" /> Placement
                <span className="normal-case text-slate-400 font-semibold">(optional)</span>
              </span>
              <input
                type="text"
                placeholder="e.g. Popular, Animation"
                value={draft.placement}
                onChange={(e) => setDraft({ ...draft, placement: e.target.value })}
                className={inputCls}
              />
            </label>
          )}
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <StickyNote className="w-3 h-3" /> Note
            </span>
            <input
              type="text"
              placeholder="e.g. Dizno launch campaign"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>

        <button
          onClick={addDraft}
          disabled={!draft.shotUrl || !/^\d{4}-\d{2}-\d{2}$/.test(draft.start)}
          className="mt-4 flex items-center gap-1.5 pink-gradient text-white text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-40 hover:brightness-105 transition-all shadow-sm shadow-pink-200/50"
        >
          <Plus className="w-3.5 h-3.5" /> Add {draft.kind === 'boost' ? 'boost' : 'feature'}
        </button>
        </div>
      </div>

      {/* ============ CAMPAIGN EFFICIENCY ============ */}
      {campaignRows.length > 0 && (
        <div className={`${CARD} p-6`}>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5 mb-1">
            Campaign Impact <InfoTip k="promoImpact" />
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-4">
            What each promotion actually delivered while it was running
          </p>
          <div style={{ height: Math.max(200, campaignRows.length * 42 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignRows} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  tickFormatter={compact}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                  cursor={{ fill: '#F8FAFC' }}
                />
                <Legend {...legendProps} />
                <Bar dataKey="views" name="Views gained" radius={[0, 5, 5, 0]} maxBarSize={22}>
                  {campaignRows.map((r) => (
                    <Cell key={r.id} fill={r.kind === 'boost' ? C.paid : C.featured} />
                  ))}
                </Bar>
                <Bar dataKey="interactions" name="Interactions" fill={C.organic} radius={[0, 5, 5, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ============ REGISTRY TABLE ============ */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              Registry <InfoTip k="promoRegistry" />
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {working.filter((e) => e.kind === 'boost').length} paid ·{' '}
              {working.filter((e) => e.kind === 'featured').length} featured
              {dirty && <span className="text-amber-600 font-bold"> · unsaved changes</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(
                [
                  { k: 'all' as const, label: 'All' },
                  { k: 'boost' as const, label: 'Paid' },
                  { k: 'featured' as const, label: 'Featured' },
                ] as const
              ).map(({ k, label }) => (
                <button
                  key={k}
                  onClick={() => setListFilter(k)}
                  className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
                    listFilter === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => doSave()}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 pink-gradient text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40 hover:brightness-105 transition-all shadow-sm shadow-pink-200/50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : dirty ? 'Save registry' : 'Saved'}
            </button>
          </div>
        </div>

        {visibleList.length === 0 ? (
          <div className="p-10 text-center">
            <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">
              {working.length === 0 ? 'No promotions registered yet' : 'Nothing of this kind yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              Until something is registered, every chart treats all traffic as organic. Add your first entry above —
              or confirm one of the detected spikes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3">Shot</th>
                  <th className="px-3 py-3">Kind</th>
                  <th className="px-3 py-3">Window</th>
                  <th className="px-3 py-3 text-right">Views gained</th>
                  <th className="px-3 py-3 text-right">Interactions</th>
                  <th className="px-3 py-3 text-right">CTR</th>
                  <th className="px-3 py-3">Note</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleList.map((e) => {
                  const views = gainedFor(e);
                  const inter = interactionsFor(e);
                  const ctr = e.impressions ? (views / e.impressions) * 100 : null;
                  const paid = e.kind === 'boost';
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <a
                          href={e.shotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 group"
                        >
                          {thumbByUrl.get(e.shotUrl) ? (
                            <img
                              key={thumbByUrl.get(e.shotUrl)}
                              src={thumbByUrl.get(e.shotUrl)}
                              alt=""
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-10 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-8 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-700 group-hover:text-pink-600 transition-colors line-clamp-2 max-w-[220px]">
                            {titleByUrl.get(e.shotUrl) || e.shotUrl}
                          </span>
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                            paid
                              ? 'bg-pink-50 text-pink-600 border border-pink-100'
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}
                        >
                          {paid ? <Zap className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                          {paid ? 'paid' : 'featured'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[10px] font-mono font-semibold text-slate-500 whitespace-nowrap">
                        {e.start} → {e.end || <span className="text-emerald-600">running</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-mono font-bold text-blue-600">
                        +{views.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-mono font-bold text-emerald-600">
                        +{inter.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-mono font-bold text-slate-700">
                        {ctr !== null ? (
                          <span title={`${e.impressions?.toLocaleString()} impressions bought`}>
                            {ctr.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[10px] font-semibold text-slate-400 max-w-[180px] truncate">
                        {e.placement && <span className="text-indigo-500">{e.placement} </span>}
                        {e.note}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => removeEntry(e.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* token prompt + status */}
        {(needToken || status) && (
          <div className="p-5 border-t border-slate-100 space-y-3">
            {needToken && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-700">Paste a GitHub token to commit the registry</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This dashboard is served statically, so saving commits <code>data/boosts.json</code> through the
                  GitHub API. Create a fine-grained token with{' '}
                  <span className="font-semibold">Contents: Read and write</span> on this repository. It is stored
                  only in this browser.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="github_pat_…"
                    className={`${INPUT} font-mono`}
                  />
                  <button
                    onClick={() => doSave(tokenInput.trim())}
                    disabled={!tokenInput.trim() || saving}
                    className="pink-gradient text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            {status && (
              <p
                className={`text-xs font-semibold rounded-xl px-3.5 py-2.5 border flex items-start gap-2 ${
                  status.ok
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-red-600 bg-red-50 border-red-100'
                }`}
              >
                {status.ok ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                {status.message}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" />
        Saved to <code className="font-mono">data/boosts.json</code> in the repository
        {IS_STATIC ? ' via the GitHub API' : ' on the server'} — everyone on the team sees the same registry, and the
        Growth Analysis tab can filter these promotions out of every chart.
      </p>
    </div>
  );
}
