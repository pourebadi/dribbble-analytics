import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { HELP, HelpText } from '../helpTexts.ts';

/**
 * Help popover.
 *
 * Rendered through a portal on document.body with fixed positioning, because
 * cards and chart containers create overflow/transform contexts that would clip
 * an absolutely-positioned panel and cut the explanation in half. The panel
 * flips above the icon and shifts horizontally when it would leave the viewport,
 * and on narrow screens it becomes a bottom sheet so long text stays readable.
 *
 * Usage: <InfoTip k="growthTrend" />  or  <InfoTip help={{title, body}} />
 */
export function InfoTip({
  k,
  help,
}: {
  k?: keyof typeof HELP | string;
  help?: HelpText;
  /** kept for call-site compatibility; placement is computed automatically now */
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mobile, setMobile] = useState(false);

  const content: HelpText | undefined = help || (k ? HELP[k] : undefined);

  const place = useCallback(() => {
    const btn = btnRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;

    const isNarrow = window.innerWidth < 560;
    setMobile(isNarrow);
    if (isNarrow) {
      setPos(null);
      return;
    }

    const r = btn.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const gap = 8;

    // vertical: below the icon, flipped above when there is no room
    let top = r.bottom + gap;
    if (top + pr.height > window.innerHeight - 12) {
      const above = r.top - gap - pr.height;
      top = above >= 12 ? above : Math.max(12, window.innerHeight - pr.height - 12);
    }

    // horizontal: centred on the icon, clamped into the viewport
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    setPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  if (!content) return null;

  const panel = (
    <>
      <div
        className={`fixed inset-0 z-[95] ${mobile ? 'bg-slate-900/40 backdrop-blur-[2px]' : ''}`}
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        className={
          mobile
            ? 'fixed z-[96] left-0 right-0 bottom-0 bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl p-5 max-h-[70vh] overflow-y-auto'
            : 'fixed z-[96] bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-300/50 p-3.5 max-h-[60vh] overflow-y-auto'
        }
        style={
          mobile
            ? undefined
            : {
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: pos?.width ?? 320,
                visibility: pos ? 'visible' : 'hidden',
              }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <p className="text-[11px] font-extrabold text-slate-800 normal-case tracking-normal">
            {content.title}
          </p>
          <button
            onClick={() => setOpen(false)}
            className="p-0.5 -m-0.5 rounded text-slate-300 hover:text-slate-600 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 font-medium normal-case tracking-normal whitespace-normal break-words">
          {content.body}
        </p>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`About: ${content.title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`p-0.5 rounded-full transition-colors align-middle ${
          open ? 'text-pink-500 bg-pink-50' : 'text-slate-300 hover:text-pink-400 hover:bg-pink-50/60'
        }`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </>
  );
}
