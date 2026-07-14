/**
 * Data access layer for the dashboard.
 *
 * Two modes:
 *  - SERVER mode (default): talks to the Express API (/api/*). Manual sync works.
 *  - STATIC mode (VITE_STATIC_DATA=true at build time): reads the JSON
 *    snapshots committed to the repo (data/profiles.json, data/shots.json).
 *    Used by the GitHub Pages deployment — no backend needed; data refreshes
 *    whenever the daily GitHub Actions scrape commits new snapshots.
 */

import { Shot, Profile } from './types.ts';

export const IS_STATIC = import.meta.env.VITE_STATIC_DATA === 'true';

const BASE = import.meta.env.BASE_URL || '/';

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    let msg = `Server returned status ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export async function apiFetchProfiles(): Promise<Profile[]> {
  if (IS_STATIC) {
    const data = await getJson(`${BASE}data/profiles.json`);
    return Array.isArray(data) ? data : [];
  }
  return getJson('/api/profiles');
}

export async function apiFetchShots(profileUrl?: string | null): Promise<Shot[]> {
  if (IS_STATIC) {
    const data: Shot[] = await getJson(`${BASE}data/shots.json`);
    if (!Array.isArray(data)) return [];
    return profileUrl ? data.filter((s) => s.profileUrl === profileUrl) : data;
  }
  const url = profileUrl ? `/api/shots?profileUrl=${encodeURIComponent(profileUrl)}` : '/api/shots';
  return getJson(url);
}

export async function apiFetchLogs(profileId: string): Promise<any[]> {
  if (IS_STATIC) {
    // Read the committed log trail of the latest sync (written by the daily
    // workflow). Returns [] if no sync has exported logs yet.
    try {
      const data = await getJson(`${BASE}data/sync_logs.json`);
      return (data && data[profileId]) || [];
    } catch {
      return [];
    }
  }
  return getJson(`/api/profiles/${profileId}/logs`);
}

export interface Annotation { id: number; date: string; label: string; color?: string | null }

export async function apiFetchAnnotations(): Promise<Annotation[]> {
  if (IS_STATIC) {
    try {
      const data = await getJson(`${BASE}data/annotations.json`);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  try { return await getJson('/api/annotations'); } catch { return []; }
}

export async function apiAddAnnotation(date: string, label: string): Promise<void> {
  if (IS_STATIC) {
    throw new Error('static');
  }
  const res = await fetch('/api/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, label }),
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
}

export async function apiTriggerScrape(url: string): Promise<void> {
  if (IS_STATIC) {
    throw new Error(
      'This is the static (GitHub Pages) dashboard — data updates automatically via the daily GitHub Actions scrape. To sync manually, run the "Daily Dribbble Scrape" workflow from the repo\'s Actions tab.'
    );
  }
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    let msg = `Server returned status ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (_) {}
    throw new Error(msg);
  }
}

// ---------------------------------------------------------------------------
// GitHub Actions integration (static/GitHub Pages mode).
// Lets the dashboard trigger the "Daily Dribbble Scrape" workflow directly.
// The token is stored ONLY in the visitor's own browser (localStorage).
// ---------------------------------------------------------------------------
export const GITHUB_REPO = (import.meta.env.VITE_GITHUB_REPO as string) || '';
export const WORKFLOW_FILE = 'daily-scrape.yml';
const TOKEN_KEY = 'gh_actions_token';

export function getSavedGithubToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function saveGithubToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export async function apiDispatchGithubWorkflow(token: string): Promise<void> {
  if (!GITHUB_REPO) throw new Error('Repository is not configured (VITE_GITHUB_REPO).');
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error('GitHub rejected the token (401/403). Make sure it has Actions: Read and write permission on this repository.');
  }
  if (!res.ok && res.status !== 204) {
    let msg = `GitHub returned status ${res.status}`;
    try { const d = await res.json(); if (d && d.message) msg = d.message; } catch (_) {}
    throw new Error(msg);
  }
}

// Public repos expose run status without a token.
export async function apiLatestWorkflowRun(): Promise<{ status: string; conclusion: string | null; html_url: string } | null> {
  if (!GITHUB_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const run = data.workflow_runs && data.workflow_runs[0];
    if (!run) return null;
    return { status: run.status, conclusion: run.conclusion, html_url: run.html_url };
  } catch {
    return null;
  }
}
