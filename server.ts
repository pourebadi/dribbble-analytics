import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cron from 'node-cron';

import * as dbLayer from './src/db.ts';
import { runSync, DEFAULT_PROFILE_URL } from './src/sync.ts';

// A scrape lock older than this is considered stale (crashed/interrupted run)
const SCRAPE_LOCK_TTL_MS = 30 * 60 * 1000;

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // --- Startup: local SQLite, no external services needed ---
  const released = dbLayer.releaseStaleScrapingLocks('Previous sync was interrupted by a server restart.');
  if (released > 0) console.log(`Released ${released} stale scraping lock(s).`);
  dbLayer.ensureProfile(DEFAULT_PROFILE_URL);
  console.log(`SQLite ready at ${dbLayer.DB_PATH} — default profile: ${DEFAULT_PROFILE_URL}`);

  // Health check for hosting platforms and quick diagnostics
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      db: 'sqlite',
      dbPath: dbLayer.DB_PATH,
      uptimeSec: Math.round(process.uptime()),
      env: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/api/profiles', (req, res) => {
    try {
      res.json(dbLayer.getProfiles());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/profiles', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const profile = dbLayer.ensureProfile(url);
      res.json({ success: true, id: profile!.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/profiles/:id/logs', (req, res) => {
    try {
      res.json(dbLayer.getLogs(req.params.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/shots', (req, res) => {
    try {
      const { profileUrl } = req.query;
      res.json(dbLayer.getShots(profileUrl ? String(profileUrl) : undefined));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/annotations', (req, res) => {
    try { res.json(dbLayer.getAnnotations()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/annotations', (req, res) => {
    const { date, label, color } = req.body || {};
    if (!date || !label) return res.status(400).json({ error: 'date and label are required' });
    try {
      const a = dbLayer.addAnnotation(String(date), String(label), color ? String(color) : null);
      dbLayer.exportJsonSnapshot();
      res.json(a);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/annotations/:id', (req, res) => {
    try {
      dbLayer.deleteAnnotation(parseInt(req.params.id, 10));
      dbLayer.exportJsonSnapshot();
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/scrape', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const profile = dbLayer.ensureProfile(url);

      if (profile!.status === 'scraping') {
        const startedMs = profile!.startedAt ? new Date(profile!.startedAt).getTime() : 0;
        const age = Date.now() - startedMs;
        if (startedMs > 0 && age < SCRAPE_LOCK_TTL_MS) {
          return res.status(409).json({
            error: `A sync is already in progress (started ${Math.round(age / 60000)} min ago). Please wait for it to finish.`,
          });
        }
        console.warn(`Stale scraping lock detected for ${url}. Overriding.`);
      }

      // Fire and forget — progress is tracked in the DB and polled by the UI
      runSync(url).catch((err) => console.error(`Sync failed for ${url}:`, err?.message || err));

      res.json({ success: true, message: 'Scraping started' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Optional in-process cron (for VPS/Docker deployments).            ---
  // --- The recommended scheduler is the GitHub Actions workflow at 23:50 ---
  // --- (.github/workflows/daily-scrape.yml); enable this only if the     ---
  // --- server itself should also scrape on a schedule.                   ---
  if (process.env.ENABLE_CRON === 'true') {
    const schedule = process.env.CRON_SCHEDULE || '50 23 * * *';
    const cronOptions: any = {};
    if (process.env.CRON_TZ) cronOptions.timezone = process.env.CRON_TZ;
    console.log(`In-process cron enabled: "${schedule}"${process.env.CRON_TZ ? ` (${process.env.CRON_TZ})` : ''}`);

    cron.schedule(schedule, async () => {
      console.log('Running scheduled scrape...');
      for (const profile of dbLayer.getProfiles()) {
        if (!profile) continue;
        if (profile.status === 'scraping') {
          const startedMs = profile.startedAt ? new Date(profile.startedAt).getTime() : 0;
          if (startedMs > 0 && Date.now() - startedMs < SCRAPE_LOCK_TTL_MS) {
            console.log(`Cron: skipping ${profile.url}, a sync is already in progress.`);
            continue;
          }
        }
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await runSync(profile.url);
            break;
          } catch (err: any) {
            console.error(`Cron scrape attempt ${attempt} failed for ${profile.url}: ${err?.message}`);
            if (attempt < 3) await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
          }
        }
      }
    }, cronOptions);
  }

  // --- Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Frontend is built to dist/client (see vite.config.ts) so the server
    // bundle (dist/server.cjs) is never exposed as a public static file.
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
