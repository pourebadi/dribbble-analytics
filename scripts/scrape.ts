/**
 * CLI scrape runner — used by the GitHub Actions daily workflow and by hand:
 *   npm run scrape                # scrapes PROFILE_URL (or the default)
 *   npm run scrape -- <url>       # scrapes a specific profile URL
 */
import dotenv from 'dotenv';
dotenv.config();

import { runSync, DEFAULT_PROFILE_URL } from '../src/sync.ts';
import { restoreMissingFromJson, closeDb } from '../src/db.ts';

const url = process.argv[2] || DEFAULT_PROFILE_URL;

// Heal any drift between the committed JSON snapshots and the DB before
// scraping (e.g. restores history rows the DB is missing).
const healed = restoreMissingFromJson();
if (healed.shotsAdded || healed.historyAdded) {
  console.log(`Restored from JSON snapshots: ${healed.shotsAdded} shots, ${healed.historyAdded} history rows.`);
}

runSync(url)
  .then((stats) => {
    console.log(`Done: ${stats.ok} ok / ${stats.failed} failed / ${stats.total} total.`);
    closeDb(); // flush everything into data/dribbble.db before the CI commit
    // Fail the CI job if nothing succeeded, so a fully blocked run is visible.
    if (stats.ok === 0) {
      console.error('No shots were scraped successfully.');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Scrape failed:', err?.message || err);
    closeDb();
    process.exit(1);
  });
