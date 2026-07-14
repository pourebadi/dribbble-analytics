import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { Shield, Eye, Heart, Bookmark, MessageCircle, ExternalLink } from 'lucide-react';
import { Shot } from '../types.ts';
import { apiFetchShots } from '../api.ts';

/**
 * Read-only public share view: #/share/growth or #/share/mix
 * Renders a single chart without requiring login — for sending to clients.
 */
export function ShareView({ chartId }: { chartId: string }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    apiFetchShots(null)
      .then(data => { setShots(Array.isArray(data) ? data : []); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  const valid = useMemo(() => shots.filter(s => s.status === 'ok'), [shots]);

  const totals = useMemo(() => valid.reduce(
    (a, s) => ({ views: a.views + (s.views || 0), likes: a.likes + (s.likes || 0), saves: a.saves + (s.saves || 0), comments: a.comments + (s.comments || 0) }),
    { views: 0, likes: 0, saves: 0, comments: 0 }
  ), [valid]);

  // carry-forward daily account totals (same algorithm as the dashboard)
  const history = useMemo(() => {
    const dateSet = new Set<string>();
    valid.forEach(s => (s.history || []).forEach((h: any) => h?.date && dateSet.add(h.date)));
    const dates = Array.from(dateSet).sort();
    const result = dates.map(date => ({ name: date, Views: 0, Likes: 0 }));
    valid.forEach(s => {
      const hist = (s.history || []).filter((h: any) => h?.date).sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
      let hi = 0; let last: any = null;
      for (const point of result) {
        while (hi < hist.length && hist[hi].date <= point.name) { last = hist[hi]; hi++; }
        if (last) { point.Views += last.views || 0; point.Likes += last.likes || 0; }
      }
    });
    return result.map(r => {
      let label = r.name;
      try { label = new Date(r.name + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { /* keep */ }
      return { ...r, name: label };
    });
  }, [valid]);

  const mix = [
    { name: 'Likes', value: totals.likes, color: '#EA4C89' },
    { name: 'Saves', value: totals.saves, color: '#8B5CF6' },
    { name: 'Comments', value: totals.comments, color: '#10B981' },
  ];
  const interactions = totals.likes + totals.saves + totals.comments;

  const title = chartId === 'mix' ? 'Engagement Mix' : 'Account Growth';
  const subtitle = chartId === 'mix'
    ? 'How the audience interacts across the Heli Studio portfolio'
    : 'Cumulative views & likes across all shots, logged daily';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 pink-gradient rounded-xl flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-slate-800 text-sm">Heli Studio · Dribbble Analytics</p>
              <p className="text-[10px] text-slate-400 font-semibold">Read-only shared view</p>
            </div>
          </div>
          <a href="https://dribbble.com/helistudio" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-pink-600 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> dribbble.com/helistudio
          </a>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h1 className="font-bold text-slate-800 text-base">{title}</h1>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>

          {state === 'loading' && <div className="h-[300px] flex items-center justify-center text-xs text-slate-400 font-semibold">Loading data…</div>}
          {state === 'error' && <div className="h-[300px] flex items-center justify-center text-xs text-red-500 font-semibold">Could not load data.</div>}

          {state === 'ready' && chartId === 'mix' && (
            <div className="relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} cornerRadius={6} stroke="none">
                    {mix.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 font-mono">{interactions.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">interactions</span>
              </div>
            </div>
          )}

          {state === 'ready' && chartId !== 'mix' && (
            history.length < 2 ? (
              <div className="h-[300px] flex items-center justify-center text-xs text-slate-400 font-semibold">Trend appears once 2+ days are logged.</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="shareViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="Views" stroke="#3B82F6" strokeWidth={2.5} fill="url(#shareViews)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="Likes" stroke="#EA4C89" strokeWidth={2} fill="transparent" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {state === 'ready' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
              {([
                { label: 'Views', value: totals.views, color: '#3B82F6', Icon: Eye },
                { label: 'Likes', value: totals.likes, color: '#EA4C89', Icon: Heart },
                { label: 'Saves', value: totals.saves, color: '#8B5CF6', Icon: Bookmark },
                { label: 'Comments', value: totals.comments, color: '#10B981', Icon: MessageCircle },
              ] as const).map(({ label, value, color, Icon }) => (
                <div key={label} className="text-center">
                  <div className="inline-flex p-1.5 rounded-lg mb-1" style={{ background: `${color}15`, color }}><Icon className="w-3.5 h-3.5" /></div>
                  <p className="text-sm font-black text-slate-800 font-mono">{value.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-center text-[10px] text-slate-400 font-medium mt-4">Updated automatically by the daily sync · {valid.length} shots tracked</p>
      </div>
    </div>
  );
}
