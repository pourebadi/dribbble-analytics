/**
 * Dribbble scraper — direct TypeScript port of the proven Python/Playwright scraper.
 *
 * Architecture (identical to the Python version that runs correctly in Docker):
 *   1. Open the profile page, dismiss the cookie banner.
 *   2. Scroll and collect links matching /shots/<id> until no new links appear
 *      for `SAME_COUNT_ROUNDS_LIMIT` rounds (or MAX_SHOTS reached).
 *   3. For every shot URL, sequentially (single page, single worker):
 *        goto -> wait PAGE_DELAY -> click the public "Detail actions" button
 *        -> wait for #details-modal -> read inner_text -> parse.
 *   4. Timeouts are retried up to MAX_RETRIES times; other errors mark the
 *      shot as failed immediately (same behavior as the Python scraper).
 *
 * No resource blocking is used: the Python README notes that blocking
 * images/CSS can prevent the "Detail actions" button from rendering.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface ShotStats {
  profileUrl: string;
  url: string;
  title: string | null;
  imageUrl: string | null;
  posted: string | null;
  views: number | null;
  saves: number | null;
  likes: number | null;
  comments: number | null;
  tags: string[];
  status: string;
  error: string | null;
  scrapedAt: Date;
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export type OnLog = (msg: string, level: LogLevel, details?: any) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Settings — mirrors settings.yml of the Python project
// ---------------------------------------------------------------------------
const SETTINGS = {
  pageLoadTimeoutMs: 60000,
  clickTimeoutMs: 10000,
  modalTimeoutMs: 10000,
  pageDelayMs: 1200,
  scrollDelayMs: 1500,
  sameCountRoundsLimit: 8,
  maxRetries: 2,
  viewport: { width: 1366, height: 900 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
};

// ---------------------------------------------------------------------------
// Parsing helpers — port of parser.py
// ---------------------------------------------------------------------------
export function parseNumber(value: string): number | null {
  const text = value.trim().replace(/,/g, '');
  if (text === '') return null;
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? null : n;
}

export interface ParsedModal {
  posted: string | null;
  views: number | null;
  saves: number | null;
  likes: number | null;
  comments: number | null;
  tags: string[];
}

export function parseModalText(text: string): ParsedModal {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: ParsedModal = {
    posted: null,
    views: null,
    saves: null,
    likes: null,
    comments: null,
    tags: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Posted')) {
      result.posted = line.replace(/^Posted/, '').trim();
    } else if (line === 'Views' && i + 1 < lines.length) {
      result.views = parseNumber(lines[i + 1]);
    } else if (line === 'Saves' && i + 1 < lines.length) {
      result.saves = parseNumber(lines[i + 1]);
    } else if (line === 'Likes' && i + 1 < lines.length) {
      result.likes = parseNumber(lines[i + 1]);
    } else if (line === 'Comments' && i + 1 < lines.length) {
      result.comments = parseNumber(lines[i + 1]);
    } else if (line === 'Tags') {
      result.tags = lines.slice(i + 1);
      break;
    }
  }

  return result;
}

// Port of scraper.normalize_url — strips query string and trailing slash
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Browser helpers — port of scraper.py
// ---------------------------------------------------------------------------
async function dismissCookieBanner(page: Page): Promise<void> {
  for (const label of ['Reject All', 'Accept All']) {
    try {
      await page.getByText(label, { exact: true }).click({ timeout: 1500 });
      return;
    } catch {
      // banner not present — fine
    }
  }
}

function isTimeoutError(err: any): boolean {
  return err && (err.name === 'TimeoutError' || /Timeout \d+ms exceeded/i.test(String(err.message)));
}

async function collectShotUrls(
  page: Page,
  profileUrl: string,
  maxShots: number,
  onLog?: OnLog
): Promise<string[]> {
  await page.goto(profileUrl, {
    waitUntil: 'domcontentloaded',
    timeout: SETTINGS.pageLoadTimeoutMs,
  });
  await dismissCookieBanner(page);
  await page.waitForTimeout(SETTINGS.pageDelayMs);

  const urls = new Set<string>();
  let sameCountRounds = 0;
  let round = 0;
  let loadMoreClicks = 0;

  while (urls.size < maxShots && sameCountRounds < SETTINGS.sameCountRoundsLimit) {
    round++;
    const links: string[] = await page
      .locator("a[href*='/shots/']")
      .evaluateAll((els: any[]) =>
        els.map((a: any) => a.href).filter((h: string) => /\/shots\/\d+/.test(h))
      );

    const before = urls.size;
    for (const link of links) {
      urls.add(normalizeUrl(link));
    }

    sameCountRounds = urls.size === before ? sameCountRounds + 1 : 0;

    if (onLog && urls.size !== before) {
      await onLog(`Discovery scroll round ${round}: ${urls.size} unique shot URLs so far.`, 'info', {
        round,
        collected: urls.size,
      });
    }

    // If scrolling stopped yielding new shots, try the "Load more work"
    // button some profiles show instead of pure infinite scroll.
    if (sameCountRounds >= 2 && loadMoreClicks < 5) {
      try {
        const loadMore = page.getByRole('button', { name: /load more/i }).first();
        if (await loadMore.isVisible({ timeout: 1000 })) {
          await loadMore.click({ timeout: 3000 });
          loadMoreClicks++;
          sameCountRounds = 0;
          if (onLog) await onLog('Clicked "Load more" to reveal additional shots.', 'info');
          await page.waitForTimeout(SETTINGS.scrollDelayMs);
        }
      } catch {
        // no such button — fine
      }
    }

    // Scroll: wheel (triggers lazy-load listeners) + hard jump to the bottom
    await page.mouse.wheel(0, 5000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(SETTINGS.scrollDelayMs);
  }

  return Array.from(urls).sort().slice(0, maxShots);
}

async function scrapeOneShot(
  page: Page,
  profileUrl: string,
  url: string,
  dismissCookie: boolean,
  onLog?: OnLog
): Promise<ShotStats> {
  let lastError: any = null;

  for (let attempt = 0; attempt < 1 + SETTINGS.maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: SETTINGS.pageLoadTimeoutMs,
      });
      await page.waitForTimeout(SETTINGS.pageDelayMs);

      if (dismissCookie) {
        await dismissCookieBanner(page);
      }

      // Click the public "Detail actions" button and wait for the modal —
      // exactly like the Python scraper.
      const button = page.getByRole('button', { name: 'Detail actions' });
      await button.first().click({ timeout: SETTINGS.clickTimeoutMs });
      await page.waitForSelector('#details-modal', { timeout: SETTINGS.modalTimeoutMs });

      const text = await page
        .locator('#details-modal')
        .innerText({ timeout: SETTINGS.modalTimeoutMs });
      const parsed = parseModalText(text);

      // Best-effort extras for the dashboard UI (not part of the Python
      // scraper, but read from the page we are already on; failures here
      // never fail the shot).
      let title: string | null = null;
      let imageUrl: string | null = null;
      try {
        const h1 = await page.locator('h1').first().innerText({ timeout: 2000 });
        title = h1.trim() || null;
      } catch {
        /* ignore */
      }
      try {
        imageUrl = await page
          .locator('meta[property="og:image"]')
          .first()
          .getAttribute('content', { timeout: 2000 });
      } catch {
        /* ignore */
      }
      if (!imageUrl) {
        // Fallback: first uploaded media image on the shot page
        try {
          imageUrl = await page
            .locator('img[src*="cdn.dribbble.com/userupload"]')
            .first()
            .getAttribute('src', { timeout: 2000 });
        } catch {
          /* ignore */
        }
      }

      return {
        profileUrl,
        url,
        title,
        imageUrl,
        posted: parsed.posted,
        views: parsed.views,
        saves: parsed.saves,
        likes: parsed.likes,
        comments: parsed.comments,
        tags: parsed.tags,
        status: 'ok',
        error: null,
        scrapedAt: new Date(),
      };
    } catch (err: any) {
      if (isTimeoutError(err)) {
        lastError = err;
        if (attempt < SETTINGS.maxRetries) {
          if (onLog) {
            await onLog(
              `Timeout on ${url} (attempt ${attempt + 1}/${1 + SETTINGS.maxRetries}). Retrying...`,
              'warn',
              { url, attempt: attempt + 1 }
            );
          }
          await page.waitForTimeout(2000);
          continue;
        }
      } else {
        // Non-timeout errors fail immediately — same as the Python scraper.
        return {
          profileUrl,
          url,
          title: null,
          imageUrl: null,
          posted: null,
          views: null,
          saves: null,
          likes: null,
          comments: null,
          tags: [],
          status: 'failed',
          error: String(err?.message || err),
          scrapedAt: new Date(),
        };
      }
    }
  }

  return {
    profileUrl,
    url,
    title: null,
    imageUrl: null,
    posted: null,
    views: null,
    saves: null,
    likes: null,
    comments: null,
    tags: [],
    status: 'failed',
    error: `timeout after ${1 + SETTINGS.maxRetries} attempts: ${lastError?.message || lastError}`,
    scrapedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Main entry — signature kept compatible with server.ts
// ---------------------------------------------------------------------------
export async function scrapeDribbbleProfile(
  profileUrl: string,
  maxShots = 200,
  onProgress?: (msg: string) => void,
  _existingShots?: any[], // kept for signature compatibility; the modal gives exact values so no cache-merging is needed
  onLog?: OnLog
): Promise<ShotStats[]> {
  const log: OnLog = async (msg, level, details) => {
    if (onLog) {
      await onLog(msg, level, details);
    } else if (onProgress) {
      onProgress(msg);
    } else {
      console.log(`[scraper:${level}] ${msg}`);
    }
  };

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    await log(`Starting scrape for profile: ${profileUrl}`, 'info', { profileUrl, maxShots });

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: SETTINGS.viewport,
      userAgent: SETTINGS.userAgent,
    });

    let page = await context.newPage();

    // ---- Phase A: discover shot URLs from the profile page ----
    await log(`Collecting shots from: ${profileUrl}`, 'info');
    const urls = await collectShotUrls(page, profileUrl, maxShots, log);
    await log(`Found ${urls.length} shot URLs`, 'info', {
      progress: { scrapedCount: 0, totalCount: urls.length },
    });

    if (urls.length === 0) {
      throw new Error(
        'No shot URLs were discovered on the profile page. The page may be blocked (CAPTCHA/WAF) or the profile URL is wrong. Aborting so stale data is not overwritten.'
      );
    }

    // ---- Phase B: scrape every shot sequentially (single page) ----
    const results: ShotStats[] = [];
    let cookieDismissed = false;

    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];

      // Recreate the page if a previous error left it closed/crashed.
      if (page.isClosed()) {
        await log('Page was closed unexpectedly — creating a fresh page.', 'warn');
        page = await context.newPage();
        cookieDismissed = false;
      }

      const result = await scrapeOneShot(page, profileUrl, url, !cookieDismissed, log);
      cookieDismissed = true;
      results.push(result);

      const done = index + 1;
      const progressDetails = { progress: { scrapedCount: done, totalCount: urls.length } };

      if (result.status === 'ok') {
        await log(
          `Scraped ${done}/${urls.length}: ${url} — views=${result.views} saves=${result.saves} likes=${result.likes} comments=${result.comments}`,
          'success',
          {
            ...progressDetails,
            url,
            metrics: {
              views: result.views,
              saves: result.saves,
              likes: result.likes,
              comments: result.comments,
            },
          }
        );
      } else {
        await log(`Failed ${done}/${urls.length}: ${url} — ${result.error}`, 'error', {
          ...progressDetails,
          url,
          error: result.error,
        });
      }

      if (onProgress) {
        onProgress(`Scraped ${done} / ${urls.length} shots`);
      }
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    await log(
      `Scrape finished: ${okCount} ok, ${results.length - okCount} failed out of ${results.length} shots.`,
      okCount === results.length ? 'success' : 'warn',
      { total: results.length, ok: okCount, failed: results.length - okCount }
    );

    return results;
  } finally {
    if (context) {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}
