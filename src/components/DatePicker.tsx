import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PICKER_TRIGGER, PICKER_TRIGGER_OPEN } from '../formStyles.ts';

/**
 * Single-date picker.
 *
 * Visually and behaviourally the sibling of DateRangePicker: same trigger
 * chrome, same month grid, same "days with logged data" dots. It exists so that
 * date entry in the Promotions page matches date entry on the charts instead of
 * falling back to a native <input type="date">, which renders differently in
 * every browser and ignores the product's styling entirely.
 *
 * Rendered through a portal so cards with overflow cannot clip the calendar.
 */
interface Props {
  value: string; // yyyy-MM-dd, '' when unset
  onChange: (iso: string) => void;
  min?: string | null;
  max?: string | null;
  /** days that have logged data — marked with a dot, as in the range picker */
  availableDates?: Set<string>;
  placeholder?: string;
  /** allows clearing back to '' (used for the optional end date) */
  clearable?: boolean;
  clearLabel?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  availableDates,
  placeholder = 'Pick a date',
  clearable = false,
  clearLabel = 'Clear',
}: Props) {
  const [open, setOpen] = useState(false);
  const anchor = value || max || toIso(new Date());
  const [viewYear, setViewYear] = useState(() => parseInt(anchor.slice(0, 4), 10));
  const [viewMonth, setViewMonth] = useState(() => parseInt(anchor.slice(5, 7), 10) - 1);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const b = btnRef.current;
    const p = panelRef.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const h = p.offsetHeight || 340;
    const w = p.offsetWidth || 290;
    const top = r.bottom + 8 + h > window.innerHeight - 12 ? Math.max(12, r.top - 8 - h) : r.bottom + 8;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const weeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(viewYear, viewMonth, 1 - offset);
    const out: { iso: string; inMonth: boolean }[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: { iso: string; inMonth: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(gridStart);
        cur.setDate(gridStart.getDate() + w * 7 + d);
        row.push({ iso: toIso(cur), inMonth: cur.getMonth() === viewMonth });
      }
      out.push(row);
    }
    return out;
  }, [viewYear, viewMonth]);

  const ym = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const canPrev = !min || ym > min.slice(0, 7);
  const canNext = !max || ym < max.slice(0, 7);

  const nav = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pick = (iso: string) => {
    if (min && iso < min) return;
    if (max && iso > max) return;
    onChange(iso);
    setOpen(false);
  };

  const panel = (
    <>
      <div className="fixed inset-0 z-[92]" onClick={() => setOpen(false)} />
      <div
        ref={panelRef}
        className="fixed z-[93] w-[290px] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/70 p-4"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => nav(-1)}
            disabled={!canPrev}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-extrabold text-slate-800">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => nav(1)}
            disabled={!canNext}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider py-1"
            >
              {w}
            </span>
          ))}
        </div>

        <div className="space-y-0.5">
          {weeks.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-y-0.5">
              {row.map(({ iso, inMonth }) => {
                const disabled = (min ? iso < min : false) || (max ? iso > max : false);
                const hasData = availableDates?.has(iso);
                const selected = iso === value;
                return (
                  <button
                    key={iso}
                    onClick={() => pick(iso)}
                    disabled={disabled}
                    className={`relative h-8 text-[11px] font-bold rounded-lg transition-all
                      ${disabled ? 'text-slate-200 cursor-not-allowed' : inMonth ? 'text-slate-700' : 'text-slate-300'}
                      ${selected ? 'bg-pink-500 !text-white shadow-sm shadow-pink-200' : !disabled ? 'hover:bg-slate-100' : ''}
                    `}
                  >
                    {parseInt(iso.slice(8), 10)}
                    {hasData && !disabled && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          selected ? 'bg-white' : 'bg-pink-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          {clearable ? (
            <button
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-pink-600 transition-colors"
            >
              {clearLabel}
            </button>
          ) : (
            <p className="text-[9px] font-semibold text-slate-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-pink-400 rounded-full" />
              dots = days with logged data
            </p>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
        className={`group ${PICKER_TRIGGER} ${open ? PICKER_TRIGGER_OPEN : ''}`}
      >
        <CalendarIcon
          className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
            open ? 'text-pink-500' : 'text-slate-400 group-hover:text-pink-400'
          }`}
        />
        {value ? (
          <span className="text-xs font-bold text-slate-700 font-mono">{fmt(value)}</span>
        ) : (
          <span className="text-xs font-semibold text-slate-400">{placeholder}</span>
        )}
      </button>
      {open && typeof document !== 'undefined' && createPortal(panel, document.body)}
    </>
  );
}
