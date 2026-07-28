/**
 * Collections — user-defined grouping of shots into projects/clients.
 *
 * The dashboard used to infer projects by parsing shot titles (everything after
 * the last "|"). That is a guess: it silently mis-files anything that does not
 * follow the convention, and the reader has no way to know it happened. Project
 * analytics built on a guess is worse than no project analytics.
 *
 * So grouping is now explicit and owned by the team. This module is the pure
 * model — types, validation and lookup helpers, with no network access — so it
 * can be imported by scripts and tests. Reading and writing lives in
 * collectionsIO.ts.
 *
 * Title parsing survives only as a *suggestion* in the Collections page, which
 * the user reviews before anything is saved.
 */

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
