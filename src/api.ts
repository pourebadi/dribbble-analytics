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
  if (IS_STATIC) return []; // no live logs on the static deployment
  return getJson(`/api/profiles/${profileId}/logs`);
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
