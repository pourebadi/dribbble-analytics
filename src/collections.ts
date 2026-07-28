/**
 * Collections — user-defined grouping of shots into projects/clients.
 *
 * The dashboard used to infer projects by parsing shot titles (everything after
 * the last "|"). That is a guess: it silently mis-files anything that does not
 * follow the convention, and the reader has no way to know it happened. Project
 * analytics built on a guess is worse than no project analytics.
 *
 * So grouping is now explicit and owned by the team. Collections are stored in
 * data/collections.json next to the promotion registry, written through the
 * Express API on a server or committed via the GitHub API on Pages, and
 * committed daily by the scrape workflow like every other file in data/.
 *
 * Title parsing survives only as a *suggestion* in the Collections page, which
 * the user reviews before anything is saved.
 */

import { IS_STATIC, GITHUB_REPO, getSavedGithubToken } from './api.ts';
import { Shot } from './types.ts';
import { shotTitle } from './analytics.ts';
import { SERIES } from './chartTheme.ts';

export interface Collection {
  id: string;
  name: string;
  /** hex colour used consistently across every chart */
  color: string;
  /** shot URLs belonging to this collection */
  shotUrls: string[];
  note: string;
}

const BASE = (import.meta as any).env?.BASE_URL || '/';
const REPO_PATH = 'data/collections.json';

export function newCollectionId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function defaultColor(index: number): string {
  return SERIES[index % SERIES.length];
}

function normalize(v: any, i: number): Collection | null {
  if (!v || typeof v.name !== 'string' || !v.name.trim()) return null;
  return {
    id: typeof v.id === 'string' && v.id ? v.id : newCollectionId(),
    name: v.name.trim().slice(0, 60),
    color: typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : defaultColor(i),
    shotUrls: Array.isArray(v.shotUrls) ? v.shotUrls.filter((u: any) => typeof u === 'string') : [],
    note: typeof v.note === 'string' ? v.note : '',
  };
}

export function sanitizeCollections(list: any): Collection[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalize).filter((c): c is Collection => c !== null);
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------
/** shotUrl → collection. A shot may live in several; the first wins for charts. */
export function collectionOfShot(collections: Collection[]): Map<string, Collection> {
  const m = new Map<string, Collection>();
  collections.forEach((c) => {
    c.shotUrls.forEach((u) => {
      if (!m.has(u)) m.set(u, c);
    });
  });
  return m;
}

export function unassignedShots(shots: Shot[], collections: Collection[]): Shot[] {
  const assigned = new Set<string>();
  collections.forEach((c) => c.shotUrls.forEach((u) => assigned.add(u)));
  return shots.filter((s) => !assigned.has(s.url));
}

/**
 * Title-based suggestion, offered only as a starting point in the Collections
 * page. Groups shots by the segment after the last "|", which is the studio's
 * existing naming convention — the user still reviews and confirms.
 */
export function suggestCollections(shots: Shot[]): Collection[] {
  const groups = new Map<string, string[]>();
  shots.forEach((s) => {
    const t = shotTitle(s);
    if (!t.includes('|')) return;
    const name = t.split('|').pop()!.trim();
    if (!name) return;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(s.url);
  });
  return Array.from(groups.entries())
    .filter(([, urls]) => urls.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, urls], i) => ({
      id: newCollectionId(),
      name,
      color: defaultColor(i),
      shotUrls: urls,
      note: 'Suggested from shot titles',
    }));
}

// ---------------------------------------------------------------------------
// Load / save (mirrors boosts.ts)
// ---------------------------------------------------------------------------
export async function fetchCollections(): Promise<Collection[]> {
  try {
    const url = IS_STATIC ? `${BASE}data/collections.json` : '/api/collections';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return sanitizeCollections(await res.json());
  } catch {
    return [];
  }
}

export interface PersistResult {
  ok: boolean;
  message: string;
  needToken?: boolean;
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function saveViaServer(list: Collection[]): Promise<PersistResult> {
  const res = await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: list }),
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
  return { ok: true, message: 'Collections saved to data/collections.json.' };
}

async function saveViaGithub(list: Collection[], token: string): Promise<PersistResult> {
  if (!GITHUB_REPO) return { ok: false, message: 'Repository is not configured (VITE_GITHUB_REPO).' };
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${REPO_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

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
    message: `chore(data): update collections (${list.length})`,
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
      'Committed data/collections.json. GitHub Pages will redeploy in ~1–2 minutes with the new grouping.',
  };
}

export async function persistCollections(
  list: Collection[],
  tokenOverride?: string
): Promise<PersistResult> {
  const clean = sanitizeCollections(list);
  if (!IS_STATIC) return saveViaServer(clean);
  const token = (tokenOverride || getSavedGithubToken()).trim();
  if (!token) {
    return {
      ok: false,
      needToken: true,
      message:
        'A GitHub token is needed to commit collections from the static dashboard (stored only in this browser).',
    };
  }
  return saveViaGithub(clean, token);
}
