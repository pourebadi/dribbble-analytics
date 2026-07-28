/**
 * Collections page — where the team defines what a "project" is.
 *
 * Grouping used to be inferred from shot titles. This page replaces that guess
 * with explicit, reviewable ownership: create a collection, drop shots into it,
 * recolour it, and every project chart across the dashboard follows.
 *
 * Title parsing survives only behind the "Suggest from titles" button, which
 * pre-fills collections the user can then edit or discard before saving.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Folder,
  FolderPlus,
  Plus,
  X,
  Trash2,
  Save,
  Search,
  Check,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Pencil,
  Inbox,
} from 'lucide-react';

import { Shot } from '../types.ts';
import { InfoTip } from './InfoTip.tsx';
import { StaticModeNotice } from './StaticModeNotice.tsx';
import { IS_STATIC } from '../api.ts';
import {
  Collection,
  newCollectionId,
  defaultColor,
  suggestCollections,
  unassignedShots,
} from '../collections.ts';
import { useCollectionDraft } from '../registryStore.ts';
import * as A from '../analytics.ts';
import { compact, CARD } from '../chartTheme.ts';
import { INPUT_WITH_ICON, INPUT, BTN_GHOST, BTN_PRIMARY } from '../formStyles.ts';

export function CollectionsPage({ shots }: { shots: Shot[] }) {
  const validShots = useMemo(() => shots.filter((s) => s.status === 'ok'), [shots]);

  // Shared store: fetched once per session, survives tab switches, and a save
  // is picked up by the Growth Analysis tab straight away.
  const { working, dirty, loaded, setWorking, discard, save } = useCollectionDraft();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [needToken, setNeedToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // keep a selection without fighting the user's clicks
  useEffect(() => {
    if (!activeId && working.length > 0) setActiveId(working[0].id);
  }, [working, activeId]);

  const active = working.find((c) => c.id === activeId) || null;
  const assignedElsewhere = useMemo(() => {
    const m = new Map<string, Collection>();
    working.forEach((c) => {
      if (c.id === activeId) return;
      c.shotUrls.forEach((u) => {
        if (!m.has(u)) m.set(u, c);
      });
    });
    return m;
  }, [working, activeId]);

  const orphans = useMemo(() => unassignedShots(validShots, working), [validShots, working]);

  const filteredShots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return validShots;
    return validShots.filter((s) => {
      const t = A.shotTitle(s).toLowerCase();
      const tags = (s.tags || []).join(' ').toLowerCase();
      return t.includes(q) || tags.includes(q);
    });
  }, [validShots, query]);

  /**
   * Rendering every shot at once stalls the page on large profiles (1,000 shots
   * means 1,000 thumbnails), so the grid grows on demand. Selected shots are
   * always shown first so the current state is never hidden behind the cap.
   */
  const [visibleCount, setVisibleCount] = useState(120);
  const [membership, setMembership] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => setVisibleCount(120), [query, activeId, membership]);

  /**
   * Ordering is frozen per (collection, search, tab).
   *
   * It used to put the selected shots first and depended on the live selection,
   * so every single click re-sorted the grid and threw the shot you just
   * touched to the top — which is why assigning a project felt like the page
   * was fighting you. The order is now captured when you switch collection,
   * search or tab, and stays put while you tick things.
   */
  const orderSignature = `${activeId}|${query}|${membership}`;
  const frozenOrder = useRef<{ sig: string; urls: string[] }>({ sig: '', urls: [] });

  const mutate = (fn: (list: Collection[]) => Collection[]) => {
    setWorking(fn(working));
    setStatus(null);
  };

  const orderedShots = useMemo(() => {
    const inSet = new Set(active?.shotUrls || []);
    const pool = filteredShots.filter((s) =>
      membership === 'all' ? true : membership === 'in' ? inSet.has(s.url) : !inSet.has(s.url)
    );

    if (frozenOrder.current.sig !== orderSignature) {
      // new context → decide an order once: members first, then by reach
      const rank = (s: Shot) => (inSet.has(s.url) ? 0 : 1);
      const sorted = [...pool].sort(
        (a, b) => rank(a) - rank(b) || (b.views || 0) - (a.views || 0)
      );
      frozenOrder.current = { sig: orderSignature, urls: sorted.map((s) => s.url) };
      return sorted;
    }

    // same context → keep the frozen order, appending anything new at the end
    const pos = new Map(frozenOrder.current.urls.map((u, i) => [u, i]));
    return [...pool].sort(
      (a, b) => (pos.get(a.url) ?? 1e9) - (pos.get(b.url) ?? 1e9)
    );
  }, [filteredShots, active, membership, orderSignature]);

  const shownShots = useMemo(() => orderedShots.slice(0, visibleCount), [orderedShots, visibleCount]);

  /** counts for the membership tabs, so the labels are never a surprise */
  const membershipCounts = useMemo(() => {
    const inSet = new Set(active?.shotUrls || []);
    let inC = 0;
    filteredShots.forEach((s) => {
      if (inSet.has(s.url)) inC += 1;
    });
    return { all: filteredShots.length, in: inC, out: filteredShots.length - inC };
  }, [filteredShots, active]);

  /** bulk add/remove everything currently listed — the difference between one
   *  click and thirty when a project has just been imported */
  const bulkToggle = (add: boolean) => {
    if (!active) return;
    const urls = orderedShots.map((s) => s.url);
    mutate((list) =>
      list.map((c) => {
        if (c.id !== active.id) return c;
        if (add) {
          const set = new Set(c.shotUrls);
          urls.forEach((u) => set.add(u));
          return { ...c, shotUrls: Array.from(set) };
        }
        const drop = new Set(urls);
        return { ...c, shotUrls: c.shotUrls.filter((u) => !drop.has(u)) };
      })
    );
  };

  // ---- mutations ----
  const addCollection = () => {
    const name = newName.trim();
    if (!name) return;
    const c: Collection = {
      id: newCollectionId(),
      name,
      color: defaultColor(working.length),
      shotUrls: [],
      note: '',
    };
    mutate((list) => [...list, c]);
    setActiveId(c.id);
    setNewName('');
  };

  const removeCollection = (id: string) => {
    mutate((list) => list.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const toggleShot = (url: string) => {
    if (!active) return;
    mutate((list) =>
      list.map((c) =>
        c.id !== active.id
          ? c
          : {
              ...c,
              shotUrls: c.shotUrls.includes(url)
                ? c.shotUrls.filter((u) => u !== url)
                : [...c.shotUrls, url],
            }
      )
    );
  };

  const setColor = (id: string, color: string) =>
    mutate((list) => list.map((c) => (c.id === id ? { ...c, color } : c)));

  const commitRename = () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (name) mutate((list) => list.map((c) => (c.id === renamingId ? { ...c, name } : c)));
    setRenamingId(null);
  };

  const applySuggestions = () => {
    const sug = suggestCollections(validShots);
    if (sug.length === 0) {
      setStatus({ ok: false, message: 'No repeated "Title | Project" pattern found to suggest from.' });
      return;
    }
    mutate(() => sug);
    setActiveId(sug[0].id);
    setStatus({
      ok: true,
      message: `${sug.length} collections suggested from shot titles — review them, then save.`,
    });
  };

  const doSave = async (tokenOverride?: string) => {
    setSaving(true);
    setStatus(null);
    const res = await save(tokenOverride);
    setSaving(false);
    if (res.needToken) {
      setNeedToken(true);
      setStatus({ ok: false, message: res.message });
      return;
    }
    setNeedToken(false);
    setStatus({ ok: res.ok, message: res.message });
  };

  const totalAssigned = new Set(working.flatMap((c) => c.shotUrls)).size;

  return (
    <div className="space-y-6">
      <StaticModeNotice file="data/collections.json" />
      {/* ---------- Header stats ---------- */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Collections',
            value: String(working.length),
            sub: 'used by every project chart',
            Icon: Folder,
            tone: 'text-pink-500 bg-pink-50',
          },
          {
            label: 'Shots assigned',
            value: `${totalAssigned}/${validShots.length}`,
            sub:
              orphans.length > 0
                ? `${orphans.length} still unassigned`
                : 'every shot has a home',
            Icon: Check,
            tone: 'text-emerald-500 bg-emerald-50',
          },
          {
            label: 'Unassigned',
            value: String(orphans.length),
            sub: 'excluded from project analytics',
            Icon: Inbox,
            tone: 'text-slate-400 bg-slate-100',
          },
        ].map(({ label, value, sub, Icon, tone }) => (
          <div key={label} className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-xl ${tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 font-mono tracking-tight">{value}</h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5">{sub}</p>
          </div>
        ))}
      </section>

      {/* ---------- Empty state ---------- */}
      {loaded && working.length === 0 && (
        <div className={`${CARD} p-10 text-center`}>
          <Folder className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">No collections yet</h3>
          <p className="text-xs text-slate-400 font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
            Project charts stay empty until you group your shots. Create a collection below, or start from a
            suggestion based on your <span className="font-mono">Title | Project</span> naming and edit from there —
            nothing is saved until you press Save.
          </p>
          <button onClick={applySuggestions} className={`${BTN_PRIMARY} mx-auto mt-4`}>
            <Sparkles className="w-3.5 h-3.5" /> Suggest from titles
          </button>
        </div>
      )}

      {/* ---------- Manager ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: collection list */}
        <div className={`${CARD} lg:col-span-4 overflow-hidden flex flex-col`}>
          <div className="p-5 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-slate-400" />
              Collections <InfoTip k="collectionsPage" />
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Click one to edit its shots</p>
          </div>

          <div className="p-3 space-y-1.5 flex-1 overflow-y-auto max-h-[420px]">
            {working.map((c) => {
              const isActive = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border transition-all ${
                    isActive ? 'border-pink-200 bg-pink-50/60 shadow-sm' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => setColor(c.id, e.target.value)}
                      title="Colour used for this collection in every chart"
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
                    />
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="flex-1 text-xs font-bold text-slate-700 bg-white border border-pink-200 rounded-lg px-2 py-1 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setActiveId(c.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <span className="block text-xs font-extrabold text-slate-700 truncate">{c.name}</span>
                        <span className="block text-[10px] font-mono font-bold text-slate-400">
                          {c.shotUrls.length} shot{c.shotUrls.length === 1 ? '' : 's'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setRenamingId(c.id);
                        setRenameValue(c.name);
                      }}
                      className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeCollection(c.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      title="Delete collection (shots are not deleted)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/40 space-y-2">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCollection()}
                placeholder="New collection name…"
                className={INPUT}
              />
              <button onClick={addCollection} disabled={!newName.trim()} className={BTN_PRIMARY}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {working.length > 0 && (
              <button onClick={applySuggestions} className={`${BTN_GHOST} w-full justify-center`}>
                <Sparkles className="w-3.5 h-3.5" /> Replace with title suggestions
              </button>
            )}
          </div>
        </div>

        {/* Right: shot assignment */}
        <div className={`${CARD} lg:col-span-8 overflow-hidden flex flex-col`}>
          <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                {active ? (
                  <>
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: active.color }}
                    />
                    <span className="truncate">{active.name}</span>
                  </>
                ) : (
                  'Shots'
                )}
                <InfoTip k="collectionsAssign" />
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {active
                  ? `${active.shotUrls.length} of ${validShots.length} shots assigned · click any card to add or remove`
                  : 'Select a collection on the left to assign shots'}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search shots or tags…"
                className={INPUT_WITH_ICON}
              />
            </div>
          </div>

          {/* Membership tabs + bulk actions. Assigning a project used to mean
              thirty individual clicks through a list that reshuffled itself
              after each one. */}
          {active && (
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(
                  [
                    { k: 'all' as const, label: 'All', n: membershipCounts.all },
                    { k: 'in' as const, label: 'In collection', n: membershipCounts.in },
                    { k: 'out' as const, label: 'Not in it', n: membershipCounts.out },
                  ] as const
                ).map(({ k, label, n }) => (
                  <button
                    key={k}
                    onClick={() => setMembership(k)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                      membership === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 font-mono text-slate-400">{n}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {orderedShots.some((sh) => !active.shotUrls.includes(sh.url)) && (
                  <button onClick={() => bulkToggle(true)} className={BTN_GHOST}>
                    <Plus className="w-3.5 h-3.5" />
                    Add all {orderedShots.filter((sh) => !active.shotUrls.includes(sh.url)).length} listed
                  </button>
                )}
                {orderedShots.some((sh) => active.shotUrls.includes(sh.url)) && (
                  <button onClick={() => bulkToggle(false)} className={BTN_GHOST}>
                    <X className="w-3.5 h-3.5" />
                    Remove {orderedShots.filter((sh) => active.shotUrls.includes(sh.url)).length} listed
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto max-h-[520px] p-3 overscroll-contain">
            {!active ? (
              <p className="text-xs text-slate-400 font-medium text-center py-16">
                No collection selected.
              </p>
            ) : orderedShots.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-16">
                {query
                  ? `No shot matches “${query}” in this tab.`
                  : membership === 'in'
                  ? 'Nothing assigned to this collection yet — switch to “Not in it” to add shots.'
                  : 'Every shot is already in this collection.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {shownShots.map((s) => {
                  const inThis = active.shotUrls.includes(s.url);
                  const other = assignedElsewhere.get(s.url);
                  return (
                    <button
                      key={s.url}
                      onClick={() => toggleShot(s.url)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-colors ${
                        inThis
                          ? 'border-pink-300 bg-pink-50 ring-1 ring-pink-100'
                          : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                          inThis ? 'bg-pink-500 border-pink-500' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {inThis && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {s.imageUrl ? (
                        <img
                          key={s.imageUrl}
                          src={s.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          decoding="async"
                          style={{ width: 44, height: 33 }}
                          className="rounded-md object-cover border border-slate-200 flex-shrink-0 bg-slate-100"
                        />
                      ) : (
                        <span
                          style={{ width: 44, height: 33 }}
                          className="rounded-md bg-slate-100 border border-slate-200 flex-shrink-0"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-slate-700 truncate leading-tight">
                          {A.shotTitle(s)}
                        </span>
                        <span className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono font-bold text-slate-400">
                            {compact(s.views || 0)} views
                          </span>
                          {other && (
                            <span
                              className="text-[9px] font-bold px-1.5 rounded truncate max-w-[110px]"
                              style={{ background: other.color + '20', color: other.color }}
                              title={`Also in "${other.name}" — charts use the first collection a shot belongs to`}
                            >
                              {other.name}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {active && orderedShots.length > shownShots.length && (
              <button
                onClick={() => setVisibleCount((n) => n + 200)}
                className={`${BTN_GHOST} mx-auto mt-3`}
              >
                Show more ({orderedShots.length - shownShots.length} remaining)
              </button>
            )}
          </div>

          {/* footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] text-slate-400 font-semibold">
              {orphans.length > 0
                ? `${orphans.length} shot${orphans.length === 1 ? '' : 's'} are in no collection and will be grouped as "Unassigned".`
                : 'Every shot belongs to a collection.'}
            </p>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  onClick={() => {
                    discard();
                    setStatus(null);
                  }}
                  className={BTN_GHOST}
                >
                  Discard changes
                </button>
              )}
              <button onClick={() => doSave()} disabled={!dirty || saving} className={BTN_PRIMARY}>
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : dirty ? 'Save collections' : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* token + status */}
      {(needToken || status) && (
        <div className={`${CARD} p-5 space-y-3`}>
          {needToken && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-700">Paste a GitHub token to commit collections</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                This dashboard is served statically, so saving commits <code>data/collections.json</code> through
                the GitHub API. Use a fine-grained token with{' '}
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
                  className={BTN_PRIMARY}
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

      <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
        <FolderPlus className="w-3 h-3" />
        Saved to <code className="font-mono">data/collections.json</code>
        {IS_STATIC ? ' via the GitHub API' : ' on the server'} — the whole team shares one grouping, and every
        project chart plus the Collections filter on Growth Analysis follows it.
      </p>
    </div>
  );
}
