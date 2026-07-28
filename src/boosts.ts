/**
 * Promotion registry — the team's manual record of which shots were promoted,
 * and how. Dribbble exposes no promotion flag publicly, so this file is the
 * source of truth for promotion-aware analytics.
 *
 * Two kinds are tracked separately because they are not comparable:
 *   - 'boost'    paid "Boosted Shots" — bought as an impression budget
 *                (1,000-250,000) that runs until spent. CTR is meaningful.
 *   - 'featured' free editorial/algorithmic exposure (Popular, Dribbble
 *                picks, category spotlight). No cost, no impression budget,
 *                but it inflates a shot exactly like a boost does.
 *
 * File name kept as boosts.json for backward compatibility with existing
 * checkouts; entries without a `kind` are treated as 'boost'.
 *
 * Storage:
 *   - SERVER mode: data/boosts.json via the Express API (/api/boosts).
 *   - STATIC mode (GitHub Pages): read from the committed data/boosts.json;
 *     writes go through the GitHub Contents API using the same fine-grained
 *     token the dashboard already stores for manual workflow dispatch
 *     (localStorage only — never sent anywhere but api.github.com).
 */

import { IS_STATIC, GITHUB_REPO, getSavedGithubToken } from './api.ts';

export type PromoKind = 'boost' | 'featured';

export const PROMO_LABEL: Record<PromoKind, string> = {
  boost: 'Boosted (paid)',
  featured: 'Featured (free)',
};

export interface BoostEntry {
  id: string;
  shotUrl: string;
  /** paid boost vs free editorial feature */
  kind: PromoKind;
  /** YYYY-MM-DD — first day the boost was active */
  start: string;
  /** YYYY-MM-DD — last day; null/empty means "still running / unknown" */
  end: string | null;
  /** impressions purchased (boost only, 1,000 – 250,000); enables CTR */
  impressions: number | null;
  /** where it was featured, e.g. "Popular" / "Animation" (featured only) */
  placement: string;
  note: string;
}

const BASE = (import.meta as any).env?.BASE_URL || '/';
const BOOSTS_REPO_PATH = 'data/boosts.json';

export function newBoostId(): string {
  return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalize(v: any): BoostEntry | null {
  if (!v || typeof v.shotUrl !== 'string' || typeof v.start !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.start)) return null;
  const end = typeof v.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.end) ? v.end : null;
  const impressions =
    typeof v.impressions === 'number' && isFinite(v.impressions) && v.impressions > 0
      ? Math.round(v.impressions)
      : null;
  const kind: PromoKind = v.kind === 'featured' ? 'featured' : 'boost';
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newBoostId(),
    shotUrl: v.shotUrl,
    kind,
    start: v.start,
    end,
    // impressions/CTR only make sense for paid boosts
    impressions: kind === 'boost' ? impressions : null,
    placement: kind === 'featured' && typeof v.placement === 'string' ? v.placement : '',
    note: typeof v.note === 'string' ? v.note : '',
  };
}

export function sanitizeBoosts(list: any): BoostEntry[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalize).filter((v): v is BoostEntry => v !== null);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
export async function fetchBoosts(): Promise<BoostEntry[]> {
  try {
    const url = IS_STATIC ? `${BASE}data/boosts.json` : '/api/boosts';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return sanitizeBoosts(await res.json());
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
export interface PersistResult {
  ok: boolean;
  message: string;
  /** static mode: the caller should ask the user for a GitHub token first */
  needToken?: boolean;
}

async function saveViaServer(list: BoostEntry[]): Promise<PersistResult> {
  const res = await fetch('/api/boosts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boosts: list }),
  });
  if (!res.ok) {
    let msg = `Server returned status ${res.status}`;
    try {
      const d = await res.json();
      if (d && d.error) msg = d.error;
    } catch {
      /* ignore */
    }
    return { ok: false, message: msg };
  }
  return { ok: true, message: 'Promotion registry saved to data/boosts.json.' };
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function saveViaGithub(list: BoostEntry[], token: string): Promise<PersistResult> {
  if (!GITHUB_REPO) {
    return { ok: false, message: 'Repository is not configured (VITE_GITHUB_REPO).' };
  }
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${BOOSTS_REPO_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // Fetch the current SHA (404 = file does not exist yet, which is fine)
  let sha: string | undefined;
  try {
    const cur = await fetch(`${apiUrl}?ref=main`, { headers });
    if (cur.ok) {
      const d = await cur.json();
      if (d && d.sha) sha = d.sha;
    } else if (cur.status === 401 || cur.status === 403) {
      return {
        ok: false,
        message:
          'GitHub rejected the token (401/403). It needs "Contents: Read and write" permission on this repository.',
      };
    }
  } catch {
    /* treat as missing */
  }

  const body: any = {
    message: `chore(data): update promotion registry (${list.filter((e) => e.kind === 'boost').length} boosted, ${list.filter((e) => e.kind === 'featured').length} featured)`,
    content: toBase64Utf8(JSON.stringify(list, null, 2) + '\n'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      message:
        'GitHub rejected the token (401/403). It needs "Contents: Read and write" permission on this repository.',
    };
  }
  if (!res.ok) {
    let msg = `GitHub returned status ${res.status}`;
    try {
      const d = await res.json();
      if (d && d.message) msg = d.message;
    } catch {
      /* ignore */
    }
    return { ok: false, message: msg };
  }
  return {
    ok: true,
    message:
      'Committed data/boosts.json to the repository. GitHub Pages will redeploy in ~1–2 minutes with the new registry.',
  };
}

/**
 * Persist the boost registry using whichever backend the dashboard runs on.
 * In static mode a token is required; pass `tokenOverride` when the user has
 * just typed one (it is then remembered like the workflow-dispatch token).
 */
export async function persistBoosts(
  list: BoostEntry[],
  tokenOverride?: string
): Promise<PersistResult> {
  const clean = sanitizeBoosts(list);
  if (!IS_STATIC) return saveViaServer(clean);
  const token = (tokenOverride || getSavedGithubToken()).trim();
  if (!token) {
    return {
      ok: false,
      needToken: true,
      message:
        'A GitHub token is needed to commit the registry from the static dashboard (stored only in this browser).',
    };
  }
  return saveViaGithub(clean, token);
}
