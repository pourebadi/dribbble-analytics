/**
 * Collections — reading and writing.
 *
 * Split from the pure model in collections.ts so that scripts and tests can use
 * the model without pulling in api.ts, whose module-level `import.meta.env`
 * only exists inside a Vite build.
 *
 * Stored in data/collections.json next to the promotion registry: written
 * through the Express API on a server, or committed via the GitHub API on
 * Pages, and committed daily by the scrape workflow like every other file in
 * data/.
 */

import { IS_STATIC, GITHUB_REPO } from './api.ts';
import { getToken, markRejected } from './githubConnection.ts';
import { Collection, sanitizeCollections } from './collections.ts';

const BASE = (import.meta as any).env?.BASE_URL || '/';
const REPO_PATH = 'data/collections.json';

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
    // A rejected token should not linger and keep failing silently.
    markRejected();
    return {
      ok: false,
      message:
        'GitHub rejected the token. It needs "Contents: Read and write" permission on this repository.',
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
    message: 'Saved. GitHub Pages redeploys in about a minute, then everyone sees it.',
  };
}

export async function persistCollections(
  list: Collection[],
  tokenOverride?: string
): Promise<PersistResult> {
  const clean = sanitizeCollections(list);
  if (!IS_STATIC) return saveViaServer(clean);
  const token = (tokenOverride || getToken()).trim();
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
