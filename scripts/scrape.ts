/**
 * CLI scrape runner — used by the GitHub Actions daily workflow and by hand:
 *   npm run scrape                # scrapes PROFILE_URL (or the default)
 *   npm run scrape -- <url>       # scrapes a specific profile URL
 */
import dotenv from 'dotenv';
dotenv.config();

import { runSync, DEFAULT_PROFILE_URL } from '../src/sync.ts';

const url = process.argv[2] || DEFAULT_PROFILE_URL;

runSync(url)
  .then((stats) => {
    console.log(`Done: ${stats.ok} ok / ${stats.failed} failed / ${stats.total} total.`);
    // Fail the CI job if nothing succeeded, so a fully blocked run is visible.
    if (stats.ok === 0) {
      console.error('No shots were scraped successfully.');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Scrape failed:', err?.message || err);
    process.exit(1);
  });
