import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, ChevronDown, X, Eye, Heart, Image as ImageIcon } from 'lucide-react';
import { Shot } from '../types.ts';
import { shotTitle } from '../analytics.ts';
import { compact } from '../chartTheme.ts';
import { PICKER_TRIGGER, PICKER_TRIGGER_OPEN } from '../formStyles.ts';

/**
 * Shot picker.
 *
 * A native <select> of 70 truncated titles is unusable for choosing the right
 * shot: no thumbnails, no search, no context. This is a combobox that shows the
 * artwork, matches on title/tag/project, supports full keyboard navigation, and
 * renders its panel through a portal so no card overflow can clip it.
 */
/**
 * Thumbnail.
 *
 * Declared at module scope on purpose: when this lived inside ShotPicker it was
 * a brand-new component type on every keystroke, so React unmounted and
 * remounted every <img>. Inside a portal-rendered scroll container that made
 * `loading="lazy"` unreliable — images frequently never re-fetched and the slot
 * kept showing whatever had been painted there before, which read as "the same
 * thumbnail repeating for different shots".
 *
 * The `key` on the <img> ties the element to its URL so React can never reuse a
 * painted image across two different shots, and eager decoding keeps a 60-row
 * dropdown correct.
 */
/** urls that failed to load, kept outside React so no component state leaks
 *  from one shot to another when list rows are recycled */
const brokenImages = new Set<string>();

function Thumb({ shot, size = 'md' }: { shot: Shot; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 36 : 48;
  const h = size === 'sm' ? 28 : 36;
  const src = shot.imageUrl;

  if (!src || brokenImages.has(src)) {
    return (
      <span
        style={{ width: w, height: h }}
        className="rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0"
      >
        <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
      </span>
    );
  }

  return (
    <img
      // Keyed by src so React can never keep a painted image when the row is
      // reused for a different shot, and sized with real width/height
      // attributes so the slot does not collapse before the image decodes.
      key={src}
      src={src}
      width={w}
      height={h}
      alt=""
      referrerPolicy="no-referrer"
      decoding="async"
      onError={(e) => {
        brokenImages.add(src);
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
      style={{ width: w, height: h, objectFit: 'cover' }}
      className="rounded-md border border-slate-200 flex-shrink-0 bg-slate-100"
    />
  );
}

export function ShotPicker({
  shots,
  value,
  onChange,
  projectOf,
  placeholder = 'Search a shot by title, tag or project…',
  triggerLabel = 'Select a shot…',
  disabledUrls,
}: {
  shots: Shot[];
  value: string;
  onChange: (url: string) => void;
  projectOf?: (url: string) => string;
  placeholder?: string;
  /** text shown on the closed trigger when nothing is selected */
  triggerLabel?: string;
  /** urls to show as already-registered (still selectable, just marked) */
  disabledUrls?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 140);
    return () => window.clearTimeout(t);
  }, [query]);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; drop: 'down' | 'up' } | null>(null);

  const selected = useMemo(() => shots.find((s) => s.url === value) || null, [shots, value]);

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const scored = shots.map((s) => {
      const title = shotTitle(s);
      const tags = (s.tags || []).join(' ');
      const project = projectOf ? projectOf(s.url) : '';
      const haystack = `${title} ${tags} ${project}`.toLowerCase();
      if (!q) return { s, title, project, score: 0, match: true };
      const idx = haystack.indexOf(q);
      const titleIdx = title.toLowerCase().indexOf(q);
      return {
        s,
        title,
        project,
        // title matches rank above tag/project matches; earlier matches rank higher
        score: titleIdx >= 0 ? titleIdx : idx >= 0 ? 1000 + idx : Infinity,
        match: idx >= 0,
      };
    });
    return scored
      .filter((r) => r.match)
      .sort((a, b) => (a.score === b.score ? (b.s.views || 0) - (a.s.views || 0) : a.score - b.score))
      .slice(0, 60);
  }, [shots, debouncedQuery, projectOf]);

  // keep the highlighted row valid and in view
  useEffect(() => setActive(0), [debouncedQuery, open]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const place = () => {
    const btn = btnRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const r = btn.getBoundingClientRect();
    const h = panel.offsetHeight || 340;
    const spaceBelow = window.innerHeight - r.bottom;
    const drop: 'down' | 'up' = spaceBelow < h + 16 && r.top > h + 16 ? 'up' : 'down';
    setPos({
      top: drop === 'down' ? r.bottom + 6 : r.top - 6 - h,
      left: r.left,
      width: r.width,
      drop,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    inputRef.current?.focus();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, results.length]);

  const choose = (url: string) => {
    onChange(url);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active].s.url);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const panel = (
    <>
      <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
      <div
        ref={panelRef}
        className="fixed z-[91] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width: pos?.width ?? 360,
          maxHeight: 360,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="w-full pl-8 pr-7 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 transition-all"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div ref={listRef} className="overflow-y-auto flex-1 p-1.5">
          {results.length === 0 ? (
            <p className="text-[11px] text-slate-400 font-semibold text-center py-8">
              No shot matches &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((r, i) => {
              const isSel = r.s.url === value;
              const already = disabledUrls?.has(r.s.url);
              return (
                <button
                  key={r.s.url}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.s.url)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${
                    i === active ? 'bg-pink-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <Thumb shot={r.s} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-slate-700 truncate leading-tight">
                      {r.title}
                    </span>
                    <span className="flex items-center gap-2.5 mt-0.5">
                      {r.project && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[110px]">
                          {r.project}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-slate-400">
                        <Eye className="w-2.5 h-2.5" />
                        {compact(r.s.views || 0)}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-slate-400">
                        <Heart className="w-2.5 h-2.5" />
                        {compact(r.s.likes || 0)}
                      </span>
                      {already && (
                        <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 rounded">
                          registered
                        </span>
                      )}
                    </span>
                  </span>
                  {isSel && <Check className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-400">
            {results.length} of {shots.length} shots
          </span>
          <span className="text-[9px] font-bold text-slate-400">↑↓ navigate · ↵ select · esc close</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`${PICKER_TRIGGER} ${open ? PICKER_TRIGGER_OPEN : ''}`}
      >
        {selected ? (
          <>
            <Thumb shot={selected} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-700 truncate leading-tight">
                {shotTitle(selected)}
              </span>
              <span className="block text-[9px] font-mono font-bold text-slate-400 mt-0.5">
                {compact(selected.views || 0)} views · {compact(selected.likes || 0)} likes
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-xs font-semibold text-slate-400 truncate">{triggerLabel}</span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </>
  );
}
