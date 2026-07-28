import React, { useCallback, useMemo, useState } from 'react';
import { C } from './chartTheme.ts';

/**
 * Click-to-hide legend behaviour for Recharts.
 *
 * Dense charts (growth trend with its moving average, engagement with three
 * rate lines, stacked project areas) are hard to read when every series is
 * drawn at once. This hook lets the legend act as a set of switches: click a
 * label to hide that series, click again to bring it back, so a reader can
 * isolate one line and compare states.
 *
 * Usage:
 *   const legend = useLegendToggle(['Gain', 'MA7']);
 *   <Legend {...legend.legendProps} />
 *   <Bar dataKey="Gain" hide={legend.hidden('Gain')} … />
 */
export function useLegendToggle(initial: string[] = []) {
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setHiddenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const hidden = useCallback((key: string) => hiddenSet.has(key), [hiddenSet]);
  const reset = useCallback(() => setHiddenSet(new Set()), []);

  /**
   * Recharts hands the legend payload its own `value`/`dataKey`. We key on
   * dataKey when present so renaming a display label never breaks the toggle.
   */
  const onClick = useCallback(
    (entry: any) => {
      const key = entry?.dataKey ?? entry?.value;
      if (typeof key === 'string') toggle(key);
    },
    [toggle]
  );

  const formatter = useCallback(
    (value: any, entry: any) => {
      const key = entry?.dataKey ?? value;
      const off = typeof key === 'string' && hiddenSet.has(key);
      return (
        <span
          style={{
            color: off ? '#CBD5E1' : C.label,
            textDecoration: off ? 'line-through' : 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 11,
            userSelect: 'none',
          }}
          title={off ? 'Click to show this series' : 'Click to hide this series'}
        >
          {value}
        </span>
      );
    },
    [hiddenSet]
  );

  const legendProps = useMemo(
    () => ({
      onClick,
      formatter,
      iconType: 'circle' as const,
      iconSize: 8,
      wrapperStyle: { fontSize: 11, fontWeight: 700, paddingTop: 8, cursor: 'pointer' },
    }),
    [onClick, formatter]
  );

  const anyHidden = hiddenSet.size > 0;

  return { hidden, toggle, reset, legendProps, anyHidden, hiddenSet };
}

/**
 * Small "show all" affordance, rendered next to a chart whose legend currently
 * has hidden series — otherwise a hidden line is easy to forget about.
 */
export function LegendResetHint({ anyHidden, reset }: { anyHidden: boolean; reset: () => void }) {
  if (!anyHidden) return null;
  return (
    <button
      onClick={reset}
      className="text-[10px] font-bold text-pink-600 bg-pink-50 border border-pink-100 px-2 py-1 rounded-lg hover:bg-pink-100 transition-colors"
    >
      Show all series
    </button>
  );
}
