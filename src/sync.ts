/**
 * runSync — the one entry point that scrapes a profile and stores the results
 * in the local SQLite DB. Used by:
 *   - the Express server ("Trigger Manual Sync" button + optional in-process cron)
 *   - scripts/scrape.ts (the CLI that GitHub Actions runs daily at 23:50)
 */

import { scrapeDribbbleProfile } from './scraper/dribbble.ts';
import * as dbLayer from './db.ts';

export const DEFAULT_PROFILE_URL = process.env.PROFILE_URL || 'https://dribbble.com/helistudio';
export const MAX_SHOTS = parseInt(process.env.MAX_SHOTS || '200', 10);

export async function runSync(profileUrl: string): Promise<{ ok: number; failed: number; total: number }> {
  const profile = dbLayer.ensureProfile(profileUrl);
  const profileId = profile!.id;

  dbLayer.clearLogs(profileId);
  dbLayer.updateProfile(profileUrl, {
    status: 'scraping',
    startedAt: new Date().toISOString(),
    error: null,
    progressMessage: 'Initializing...',
    scrapedCount: 0,
    totalCount: 0,
  });

  const log = (msg: string, level: 'info' | 'success' | 'warn' | 'error', details?: any) => {
    dbLayer.addLog(profileId, msg, level, details || null);
    if (details && details.progress) {
      dbLayer.updateProfile(profileUrl, {
        progressMessage: msg,
        scrapedCount: Number(details.progress.scrapedCount) || 0,
        totalCount: Number(details.progress.totalCount) || 0,
      });
    } else {
      dbLayer.updateProfile(profileUrl, { progressMessage: msg });
    }
    console.log(`[sync:${level}] ${msg}`);
  };

  try {
    log(`Initializing synchronization process for ${profileUrl}`, 'info');

    const shots = await scrapeDribbbleProfile(profileUrl, MAX_SHOTS, undefined, undefined, log);

    log('Scraper completed. Writing results to the local database...', 'info');
    dbLayer.applyScrapeResults(profileUrl, shots);

    const okShots = shots.filter((s) => s.status === 'ok');
    const failed = shots.length - okShots.length;
    const totals = okShots.reduce(
      (acc, s) => ({
        views: acc.views + (s.views || 0),
        likes: acc.likes + (s.likes || 0),
        saves: acc.saves + (s.saves || 0),
        comments: acc.comments + (s.comments || 0),
      }),
      { views: 0, likes: 0, saves: 0, comments: 0 }
    );

    log(
      `Aggregation summary: Views ${totals.views.toLocaleString()} | Likes ${totals.likes.toLocaleString()} | Saves ${totals.saves.toLocaleString()} | Comments ${totals.comments.toLocaleString()} across ${okShots.length} successful shots.`,
      'success',
      { ...totals, totalShots: shots.length }
    );

    dbLayer.updateProfile(profileUrl, {
      status: 'completed',
      lastScrapedAt: new Date().toISOString(),
      startedAt: null,
      error: null,
      progressMessage: null,
      lastRunStats: { successCount: okShots.length, failedCount: failed, total: shots.length },
    });

    dbLayer.exportJsonSnapshot();
    log(`Sync committed: ${okShots.length} ok, ${failed} failed, ${shots.length} total.`, 'success');

    return { ok: okShots.length, failed, total: shots.length };
  } catch (error: any) {
    const message = error?.message || 'Unknown execution failure';
    dbLayer.addLog(profileId, `FATAL SYNC ERROR: ${message}`, 'error', { stack: error?.stack || null });
    dbLayer.updateProfile(profileUrl, {
      status: 'failed',
      error: message,
      progressMessage: null,
      startedAt: null,
    });
    throw error;
  }
}
