/**
 * Shared chart theme.
 *
 * Every chart in the dashboard pulls its palette, tooltip, axis and grid styling
 * from here, so a Recharts surface rendered on the Dashboard, Analysis, History
 * or Promotions page looks like it belongs to the same product. Change a token
 * here and it propagates everywhere.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
export const C = {
  views: '#3B82F6',
  likes: '#EA4C89',
  saves: '#8B5CF6',
  comments: '#10B981',

  paid: '#EA4C89',
  featured: '#6366F1',
  organic: '#10B981',
  suspected: '#F59E0B',

  ink: '#0F172A',
  muted: '#94A3B8',
  label: '#64748B',
  grid: '#F1F5F9',
  axis: '#E2E8F0',
  surface: '#FFFFFF',
} as const;

/** Categorical series colours, in the order they should be handed out. */
export const SERIES = [
  '#EA4C89',
  '#8B5CF6',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#06B6D4',
  '#F472B6',
  '#94A3B8',
];

// ---------------------------------------------------------------------------
// Recharts prop presets
// ---------------------------------------------------------------------------
export const tooltipStyle = {
  backgroundColor: C.surface,
  border: `1px solid ${C.axis}`,
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600,
  padding: '8px 10px',
  boxShadow: '0 10px 30px rgba(15,23,42,0.10)',
} as const;

export const tooltipLabelStyle = {
  color: C.ink,
  fontWeight: 800,
  fontSize: '11px',
  marginBottom: '2px',
} as const;

export const gridProps = {
  strokeDasharray: '3 3',
  stroke: C.grid,
  vertical: false,
} as const;

export const legendProps = {
  wrapperStyle: { fontSize: 11, fontWeight: 700, paddingTop: 8 },
  iconType: 'circle' as const,
  iconSize: 8,
};

/** Compact axis formatter: 1200 → 1.2k, 24000 → 24k */
export const compact = (v: number): string => {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

// ---------------------------------------------------------------------------
// Shared card chrome
// ---------------------------------------------------------------------------
export const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
