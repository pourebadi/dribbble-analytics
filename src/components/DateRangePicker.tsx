import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  start: string;             // yyyy-MM-dd
  end: string;               // yyyy-MM-dd
  min: string | null;        // earliest logged date
  max: string;               // latest logged date
  availableDates: Set<string>;
  onChange: (start: string, end: string) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function DateRangePicker({ start, end, min, max, availableDates, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(() => parseInt(end.slice(0, 4), 10));
  const [viewMonth, setViewMonth] = useState(() => parseInt(end.slice(5, 7), 10) - 1); // 0-based

  const minIso = min || max;

  const weeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
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

  const canPrev = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}` > minIso.slice(0, 7);
  const canNext = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}` < max.slice(0, 7);

  const nav = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pick = (iso: string) => {
    if (iso < minIso || iso > max) return;
    if (!pendingStart) {
      setPendingStart(iso);
    } else {
      const s = iso < pendingStart ? iso : pendingStart;
      const e = iso < pendingStart ? pendingStart : iso;
      onChange(s, e);
      setPendingStart(null);
      setOpen(false);
    }
  };

  const selStart = pendingStart || start;
  const selEnd = pendingStart ? pendingStart : end;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(!open); setPendingStart(null); }}
        className={`group flex items-center gap-2.5 bg-white border rounded-xl pl-3.5 pr-3 py-2.5 transition-all shadow-sm ${
          open ? 'border-pink-300 ring-2 ring-pink-100' : 'border-slate-200 hover:border-pink-200'
        }`}
      >
        <CalendarIcon className={`w-4 h-4 transition-colors ${open ? 'text-pink-500' : 'text-slate-400 group-hover:text-pink-400'}`} />
        <span className="text-xs font-bold text-slate-700 font-mono">{fmt(start)}</span>
        <span className="text-slate-300 text-xs">→</span>
        <span className="text-xs font-bold text-slate-700 font-mono">{fmt(end)}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setPendingStart(null); }} />
          <div className="absolute z-50 mt-2 left-0 w-[290px] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/70 p-4 animate-in">
            {/* Month header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => nav(-1)} disabled={!canPrev}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
              <button
                onClick={() => nav(1)} disabled={!canNext}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(w => (
                <span key={w} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider py-1">{w}</span>
              ))}
            </div>

            {/* Day grid */}
            <div className="space-y-0.5">
              {weeks.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 gap-y-0.5">
                  {row.map(({ iso, inMonth }) => {
                    const disabled = iso < minIso || iso > max;
                    const hasData = availableDates.has(iso);
                    const isStart = iso === selStart;
                    const isEnd = iso === selEnd;
                    const inRange = !pendingStart && iso > start && iso < end;
                    return (
                      <button
                        key={iso}
                        onClick={() => pick(iso)}
                        disabled={disabled}
                        className={`relative h-8 text-[11px] font-bold rounded-lg transition-all
                          ${disabled ? 'text-slate-200 cursor-not-allowed' : inMonth ? 'text-slate-700' : 'text-slate-300'}
                          ${isStart || isEnd ? 'bg-pink-500 !text-white shadow-sm shadow-pink-200' : inRange ? 'bg-pink-50 text-pink-700' : !disabled ? 'hover:bg-slate-100' : ''}
                        `}
                      >
                        {parseInt(iso.slice(8), 10)}
                        {hasData && !disabled && (
                          <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isStart || isEnd ? 'bg-white' : 'bg-pink-400'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <p className="text-[9px] font-semibold text-slate-400">
                {pendingStart
                  ? <>Start: <span className="text-pink-600 font-mono">{fmt(pendingStart)}</span> — now pick the end day</>
                  : <><span className="inline-block w-1.5 h-1.5 bg-pink-400 rounded-full mr-1 align-middle" />dots = days with logged data</>}
              </p>
              <button
                onClick={() => { setOpen(false); setPendingStart(null); }}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
