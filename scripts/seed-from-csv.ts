/**
 * Seed the local SQLite DB from a CSV produced by the legacy Python scraper
 * (columns: url,posted,views,saves,likes,comments,tags,status,error).
 *
 *   npm run seed -- path/to/dribbble_shots.csv [profileUrl]
 *
 * Useful for bootstrapping the dashboard with real data before the first
 * GitHub Actions scrape runs. Existing shots are upserted; a history entry
 * for today is created for each ok shot.
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import * as dbLayer from '../src/db.ts';
import { DEFAULT_PROFILE_URL } from '../src/sync.ts';
import type { ShotStats } from '../src/scraper/dribbble.ts';

const csvPath = process.argv[2];
const profileUrl = process.argv[3] || DEFAULT_PROFILE_URL;

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error('Usage: npm run seed -- path/to/dribbble_shots.csv [profileUrl]');
  process.exit(1);
}

// Minimal CSV parser handling quoted fields with commas
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some((f) => f !== '')) rows.push(row); }
  return rows;
}

// "20-Feb-26" -> "Feb 20, 2026" (the format the modal scraper produces)
function normalizePosted(v: string): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (m) return `${m[2]} ${parseInt(m[1], 10)}, 20${m[3]}`;
  return v;
}

function titleFromUrl(url: string): string | null {
  try {
    const slug = new URL(url).pathname.split('/').pop() || '';
    const t = slug.replace(/^\d+-/, '').replace(/-/g, ' ').trim();
    return t || null;
  } catch { return null; }
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
const header = rows.shift()!.map((h) => h.trim().toLowerCase());
const col = (name: string) => header.indexOf(name);

const shots: ShotStats[] = rows.map((r) => {
  const status = (r[col('status')] || 'ok').trim();
  const num = (name: string) => {
    const v = parseInt((r[col(name)] || '').replace(/,/g, ''), 10);
    return Number.isNaN(v) ? null : v;
  };
  return {
    profileUrl,
    url: (r[col('url')] || '').trim(),
    title: titleFromUrl((r[col('url')] || '').trim()),
    imageUrl: null,
    posted: normalizePosted((r[col('posted')] || '').trim()),
    views: num('views'),
    saves: num('saves'),
    likes: num('likes'),
    comments: num('comments'),
    tags: (r[col('tags')] || '').split(',').map((t) => t.trim()).filter(Boolean),
    status,
    error: (r[col('error')] || '').trim() || null,
    scrapedAt: new Date(),
  };
}).filter((s) => s.url);

dbLayer.ensureProfile(profileUrl);
dbLayer.applyScrapeResults(profileUrl, shots);

const ok = shots.filter((s) => s.status === 'ok').length;
dbLayer.updateProfile(profileUrl, {
  status: 'completed',
  lastScrapedAt: new Date().toISOString(),
  error: null,
  progressMessage: null,
  scrapedCount: shots.length,
  totalCount: shots.length,
  lastRunStats: { successCount: ok, failedCount: shots.length - ok, total: shots.length },
});
dbLayer.addLog(dbLayer.profileIdFromUrl(profileUrl), `Seeded ${ok} shots from CSV: ${csvPath}`, 'success', { total: shots.length });
dbLayer.exportJsonSnapshot();

console.log(`Seeded ${ok} ok / ${shots.length} total shots into ${dbLayer.DB_PATH}`);
dbLayer.closeDb();
