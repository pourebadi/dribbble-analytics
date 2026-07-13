/**
 * Local SQLite data layer (replaces Firebase/Firestore).
 *
 * Tables:
 *   profiles     — one row per tracked Dribbble profile
 *   shots        — current snapshot per shot
 *   shot_history — one row per shot per day (the daily log all analytics derive from)
 *   sync_logs    — detailed log lines of the latest sync per profile
 *
 * The DB file lives in ./data/dribbble.db so it can be committed by the
 * GitHub Actions daily-scrape workflow and mounted as a Docker volume.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { ShotStats } from './scraper/dribbble.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'dribbble.db');

const db = new Database(DB_PATH);
// IMPORTANT: DELETE journal mode keeps ALL data inside the single .db file.
// WAL mode would leave fresh writes in a separate -wal file (gitignored),
// which caused the committed database to silently go stale in CI.
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');

/** Flush and close the database. MUST be called before a CLI process exits
 *  so the committed .db file contains every write. */
export function closeDb() {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* no-op in DELETE mode */ }
  try { db.close(); } catch { /* already closed */ }
}

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT,
  started_at TEXT,
  last_scraped_at TEXT,
  error TEXT,
  progress_message TEXT,
  scraped_count INTEGER,
  total_count INTEGER,
  last_run_stats TEXT
);

CREATE TABLE IF NOT EXISTS shots (
  url TEXT PRIMARY KEY,
  profile_url TEXT NOT NULL,
  title TEXT,
  image_url TEXT,
  posted TEXT,
  views INTEGER,
  saves INTEGER,
  likes INTEGER,
  comments INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  scraped_at TEXT,
  last_error TEXT,
  last_failed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shots_profile ON shots(profile_url);

CREATE TABLE IF NOT EXISTS shot_history (
  shot_url TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (shot_url, date)
);
CREATE INDEX IF NOT EXISTS idx_history_shot ON shot_history(shot_url);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT NOT NULL,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_profile ON sync_logs(profile_id);
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function profileIdFromUrl(url: string): string {
  return Buffer.from(url).toString('base64url');
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToProfile(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    lastScrapedAt: row.last_scraped_at,
    error: row.error,
    progressMessage: row.progress_message,
    scrapedCount: row.scraped_count,
    totalCount: row.total_count,
    lastRunStats: row.last_run_stats ? JSON.parse(row.last_run_stats) : null,
  };
}

function rowToShot(row: any, history: any[]) {
  return {
    profileUrl: row.profile_url,
    url: row.url,
    title: row.title,
    imageUrl: row.image_url,
    posted: row.posted,
    views: row.views,
    saves: row.saves,
    likes: row.likes,
    comments: row.comments,
    tags: row.tags ? JSON.parse(row.tags) : [],
    status: row.status,
    error: row.error,
    scrapedAt: row.scraped_at,
    lastError: row.last_error,
    lastFailedAt: row.last_failed_at,
    history,
  };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export function getProfiles() {
  return db.prepare('SELECT * FROM profiles ORDER BY created_at').all().map(rowToProfile);
}

export function getProfileByUrl(url: string) {
  return rowToProfile(db.prepare('SELECT * FROM profiles WHERE url = ?').get(url));
}

export function ensureProfile(url: string) {
  const id = profileIdFromUrl(url);
  db.prepare(
    `INSERT INTO profiles (id, url, status, created_at) VALUES (?, ?, 'pending', ?)
     ON CONFLICT(id) DO NOTHING`
  ).run(id, url, nowIso());
  return getProfileByUrl(url);
}

export function updateProfile(url: string, fields: Record<string, any>) {
  const map: Record<string, string> = {
    status: 'status',
    startedAt: 'started_at',
    lastScrapedAt: 'last_scraped_at',
    error: 'error',
    progressMessage: 'progress_message',
    scrapedCount: 'scraped_count',
    totalCount: 'total_count',
    lastRunStats: 'last_run_stats',
  };
  const sets: string[] = [];
  const values: any[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in fields) {
      sets.push(`${col} = ?`);
      values.push(k === 'lastRunStats' && fields[k] !== null ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (sets.length === 0) return;
  values.push(url);
  db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE url = ?`).run(...values);
}

export function releaseStaleScrapingLocks(reason: string) {
  const stuck = db.prepare(`SELECT url FROM profiles WHERE status = 'scraping'`).all() as any[];
  for (const p of stuck) {
    updateProfile(p.url, { status: 'failed', error: reason, progressMessage: null });
  }
  return stuck.length;
}

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------
export function getShots(profileUrl?: string) {
  const rows = (profileUrl
    ? db.prepare('SELECT * FROM shots WHERE profile_url = ?').all(profileUrl)
    : db.prepare('SELECT * FROM shots').all()) as any[];

  const historyStmt = db.prepare(
    'SELECT date, timestamp, views, likes, saves, comments FROM shot_history WHERE shot_url = ? ORDER BY date'
  );
  return rows.map((row) => rowToShot(row, historyStmt.all(row.url)));
}

// ---------------------------------------------------------------------------
// Sync logs
// ---------------------------------------------------------------------------
export function clearLogs(profileId: string) {
  db.prepare('DELETE FROM sync_logs WHERE profile_id = ?').run(profileId);
}

export function addLog(profileId: string, message: string, level: string, details: any = null) {
  db.prepare(
    'INSERT INTO sync_logs (profile_id, timestamp, message, level, details) VALUES (?, ?, ?, ?, ?)'
  ).run(profileId, nowIso(), message, level, details ? JSON.stringify(details) : null);
}

export function getLogs(profileId: string) {
  return (db.prepare('SELECT * FROM sync_logs WHERE profile_id = ? ORDER BY id').all(profileId) as any[]).map(
    (r) => ({
      id: r.id,
      message: r.message,
      level: r.level,
      timestamp: r.timestamp,
      details: r.details ? JSON.parse(r.details) : null,
    })
  );
}

// ---------------------------------------------------------------------------
// Applying scrape results — same rules as before:
//  * ok shots: update the snapshot and upsert today's history row (re-running
//    on the same day replaces that day's row, so no duplicate day nodes)
//  * failed shots with existing data: keep old data untouched, only record
//    last_error / last_failed_at
//  * failed brand-new shots: stored as status='failed' with no history
// ---------------------------------------------------------------------------
/** YYYY-MM-DD in HISTORY_TZ (default UTC). Controls which calendar day a
 *  sync's history row belongs to — set HISTORY_TZ=Asia/Tehran (etc.) so runs
 *  around local midnight land on the local business day. */
export function historyDayString(d: Date = new Date()): string {
  const tz = process.env.HISTORY_TZ;
  if (!tz) return d.toISOString().split('T')[0];
  try {
    return d.toLocaleDateString('en-CA', { timeZone: tz }); // en-CA => YYYY-MM-DD
  } catch {
    return d.toISOString().split('T')[0];
  }
}

export const applyScrapeResults = db.transaction((profileUrl: string, shots: ShotStats[]) => {
  const todayStr = historyDayString();
  const nowTs = Date.now();

  const getExisting = db.prepare('SELECT url FROM shots WHERE url = ?');
  const upsertShot = db.prepare(`
    INSERT INTO shots (url, profile_url, title, image_url, posted, views, saves, likes, comments, tags, status, error, scraped_at, last_error, last_failed_at)
    VALUES (@url, @profile_url, @title, @image_url, @posted, @views, @saves, @likes, @comments, @tags, @status, @error, @scraped_at, NULL, NULL)
    ON CONFLICT(url) DO UPDATE SET
      profile_url = excluded.profile_url,
      title = COALESCE(excluded.title, shots.title),
      image_url = COALESCE(excluded.image_url, shots.image_url),
      posted = COALESCE(excluded.posted, shots.posted),
      views = excluded.views,
      saves = excluded.saves,
      likes = excluded.likes,
      comments = excluded.comments,
      tags = excluded.tags,
      status = excluded.status,
      error = excluded.error,
      scraped_at = excluded.scraped_at,
      last_error = NULL,
      last_failed_at = NULL
  `);
  const markFailed = db.prepare('UPDATE shots SET last_error = ?, last_failed_at = ? WHERE url = ?');
  const insertFailedNew = db.prepare(`
    INSERT INTO shots (url, profile_url, title, image_url, posted, views, saves, likes, comments, tags, status, error, scraped_at)
    VALUES (@url, @profile_url, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'failed', @error, @scraped_at)
    ON CONFLICT(url) DO UPDATE SET error = excluded.error, scraped_at = excluded.scraped_at
  `);
  const upsertHistory = db.prepare(`
    INSERT INTO shot_history (shot_url, date, timestamp, views, likes, saves, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shot_url, date) DO UPDATE SET
      timestamp = excluded.timestamp,
      views = excluded.views,
      likes = excluded.likes,
      saves = excluded.saves,
      comments = excluded.comments
  `);

  for (const shot of shots) {
    const scrapedAtIso =
      shot.scrapedAt instanceof Date ? shot.scrapedAt.toISOString() : String(shot.scrapedAt);

    if (shot.status !== 'ok') {
      const exists = getExisting.get(shot.url);
      if (exists) {
        markFailed.run(shot.error || 'unknown error', scrapedAtIso, shot.url);
      } else {
        insertFailedNew.run({ url: shot.url, profile_url: profileUrl, error: shot.error || 'unknown error', scraped_at: scrapedAtIso });
      }
      continue;
    }

    upsertShot.run({
      url: shot.url,
      profile_url: profileUrl,
      title: shot.title,
      image_url: shot.imageUrl,
      posted: shot.posted,
      views: shot.views ?? 0,
      saves: shot.saves ?? 0,
      likes: shot.likes ?? 0,
      comments: shot.comments ?? 0,
      tags: JSON.stringify(shot.tags || []),
      status: 'ok',
      error: null,
      scraped_at: scrapedAtIso,
    });

    upsertHistory.run(
      shot.url,
      todayStr,
      nowTs,
      shot.views ?? 0,
      shot.likes ?? 0,
      shot.saves ?? 0,
      shot.comments ?? 0
    );
  }
});

// ---------------------------------------------------------------------------
// JSON export — a human/tool friendly snapshot next to the DB, refreshed after
// every scrape (handy for the GitHub repo history and quick inspection).
// ---------------------------------------------------------------------------
export function exportJsonSnapshot() {
  const profiles = getProfiles();
  const shots = getShots();
  fs.writeFileSync(path.join(DATA_DIR, 'profiles.json'), JSON.stringify(profiles, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'shots.json'), JSON.stringify(shots, null, 2), 'utf-8');

  // Persist the full log trail of the latest sync per profile. This file is
  // committed by the daily workflow, so every run's diagnostics (including
  // per-shot failures with their exact errors) live in the repo history and
  // are shown in the dashboard's "Show Console" panel on GitHub Pages.
  const logsByProfile: Record<string, any[]> = {};
  for (const p of profiles) {
    if (p) logsByProfile[p.id] = getLogs(p.id);
  }
  fs.writeFileSync(path.join(DATA_DIR, 'sync_logs.json'), JSON.stringify(logsByProfile, null, 2), 'utf-8');
}

/**
 * Self-healing restore: merges data from the committed JSON snapshots
 * (data/shots.json) into the DB WITHOUT overwriting anything the DB already
 * has. Heals drift where the JSONs advanced but the .db did not (e.g. the
 * historical WAL bug). Safe to run before every scrape:
 *   - shots missing from the DB are inserted from JSON
 *   - history rows missing from the DB are inserted (never replaced)
 */
export function restoreMissingFromJson(): { shotsAdded: number; historyAdded: number } {
  const jsonPath = path.join(DATA_DIR, 'shots.json');
  if (!fs.existsSync(jsonPath)) return { shotsAdded: 0, historyAdded: 0 };

  let jsonShots: any[] = [];
  try { jsonShots = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch { return { shotsAdded: 0, historyAdded: 0 }; }
  if (!Array.isArray(jsonShots)) return { shotsAdded: 0, historyAdded: 0 };

  let shotsAdded = 0;
  let historyAdded = 0;

  const getShot = db.prepare('SELECT url FROM shots WHERE url = ?');
  const insertShot = db.prepare(`
    INSERT OR IGNORE INTO shots (url, profile_url, title, image_url, posted, views, saves, likes, comments, tags, status, error, scraped_at)
    VALUES (@url, @profile_url, @title, @image_url, @posted, @views, @saves, @likes, @comments, @tags, @status, @error, @scraped_at)
  `);
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO shot_history (shot_url, date, timestamp, views, likes, saves, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    for (const s of jsonShots) {
      if (!s || !s.url) continue;
      if (!getShot.get(s.url)) {
        insertShot.run({
          url: s.url,
          profile_url: s.profileUrl || '',
          title: s.title ?? null,
          image_url: s.imageUrl ?? null,
          posted: s.posted ?? null,
          views: s.views ?? null,
          saves: s.saves ?? null,
          likes: s.likes ?? null,
          comments: s.comments ?? null,
          tags: JSON.stringify(s.tags || []),
          status: s.status || 'ok',
          error: s.error ?? null,
          scraped_at: s.scrapedAt ?? null,
        });
        shotsAdded++;
      }
      for (const h of s.history || []) {
        if (!h || !h.date) continue;
        const r = insertHistory.run(s.url, h.date, h.timestamp || 0, h.views || 0, h.likes || 0, h.saves || 0, h.comments || 0);
        if (r.changes > 0) historyAdded++;
      }
    }
  });
  run();

  return { shotsAdded, historyAdded };
}

export default db;
