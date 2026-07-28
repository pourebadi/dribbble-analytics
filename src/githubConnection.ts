/**
 * GitHub connection.
 *
 * The dashboard can run two ways. Self-hosted it talks to its own Express
 * server and no token exists at all. Served statically from GitHub Pages there
 * is no server to write to, so saving commits the JSON files through GitHub's
 * API — and that needs credentials from the browser.
 *
 * What this module does about that:
 *
 *  - **Asks once.** A token that is verified and stored is reused for every
 *    later save. Previously it was accepted, used, and thrown away, so people
 *    were asked again every single time.
 *  - **Verifies before storing.** The token is checked against the repository
 *    for actual write permission, so a typo or a read-only token fails at
 *    connect time with a specific reason instead of silently at save time.
 *  - **Records who and until when.** The account name and the token's expiry
 *    are kept alongside it, so the UI can show a real connection state and warn
 *    before the token lapses rather than after a failed save.
 *  - **Clears itself when revoked.** A 401/403 during a save wipes the stored
 *    token so the app never sits in a broken loop.
 *
 * On the security of storing it in the browser: there is no server here, so a
 * browser-held credential is the only mechanism available. It is mitigated
 * rather than eliminated — the UI asks for a *fine-grained* token limited to
 * this one repository with only `Contents: Read and write`, which cannot touch
 * anything else in the account, and encourages an expiry date. The token is
 * sent only to api.github.com and is never written into the repository. Anyone
 * who wants no browser credential at all should self-host, where the server
 * writes the files and this whole path is unused.
 */

import { GITHUB_REPO } from './api.ts';

const TOKEN_KEY = 'gh_actions_token';
const META_KEY = 'gh_connection_meta';

export interface ConnectionMeta {
  /** GitHub login the token belongs to */
  login: string;
  /** ISO date the token expires, when GitHub reports one */
  expiresAt: string | null;
  /** when the connection was established */
  connectedAt: string;
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getMeta(): ConnectionMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as ConnectionMeta) : null;
  } catch {
    return null;
  }
}

export function isConnected(): boolean {
  return !!getToken().trim();
}

export function disconnect() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

function store(token: string, meta: ConnectionMeta) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  notify();
}

// --- subscribers, so every surface reacts the moment the state changes -------
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeConnection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Days until the token expires; null when GitHub reports no expiry. */
export function daysUntilExpiry(): number | null {
  const meta = getMeta();
  if (!meta?.expiresAt) return null;
  const ms = new Date(meta.expiresAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export interface ConnectResult {
  ok: boolean;
  message: string;
  meta?: ConnectionMeta;
}

/**
 * Verify a token can write to this repository, then store it.
 *
 * Checks permissions explicitly rather than assuming: a token that can read but
 * not push would otherwise appear to connect and then fail on the first save.
 */
export async function connect(rawToken: string): Promise<ConnectResult> {
  const token = rawToken.trim();
  if (!token) return { ok: false, message: 'Paste a token first.' };
  if (!GITHUB_REPO) {
    return { ok: false, message: 'This build has no repository configured (VITE_GITHUB_REPO).' };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, { headers });
  } catch {
    return { ok: false, message: 'Could not reach GitHub. Check your connection and try again.' };
  }

  if (res.status === 401) {
    return { ok: false, message: 'GitHub does not recognise this token. Check you pasted all of it.' };
  }
  if (res.status === 404 || res.status === 403) {
    return {
      ok: false,
      message: `This token cannot see ${GITHUB_REPO}. Under "Repository access" choose "Only select repositories" and pick this one.`,
    };
  }
  if (!res.ok) {
    return { ok: false, message: `GitHub returned ${res.status}. Try again in a moment.` };
  }

  const repo = await res.json();
  if (repo?.permissions && repo.permissions.push !== true) {
    return {
      ok: false,
      message: 'This token can read the repository but not write to it. Set Contents: Read and write.',
    };
  }

  // GitHub reports fine-grained token expiry in a response header.
  const expiresAt = res.headers.get('github-authentication-token-expiration');
  let login = 'your account';
  try {
    const who = await fetch('https://api.github.com/user', { headers });
    if (who.ok) {
      const u = await who.json();
      if (u?.login) login = u.login;
    }
  } catch {
    /* the name is a nicety, not a requirement */
  }

  const meta: ConnectionMeta = {
    login,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    connectedAt: new Date().toISOString(),
  };
  store(token, meta);
  return { ok: true, message: `Connected as ${login}.`, meta };
}

/**
 * Called by the save paths when GitHub rejects the stored credential, so a
 * revoked or expired token never leaves the app stuck retrying it.
 */
export function markRejected() {
  disconnect();
}

/** URL that opens GitHub's fine-grained token form. */
export const NEW_TOKEN_URL =
  'https://github.com/settings/personal-access-tokens/new';
