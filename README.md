# Dribbble Analytics Dashboard

Tracks a Dribbble profile's shots (views / likes / saves / comments / tags),
logs a daily snapshot per shot into a **local SQLite database**, and serves a
React dashboard with growth analytics. No external services required.

## Architecture at a glance

```
scraper (Playwright)  →  SQLite  →  JSON snapshots  →  React dashboard
      daily             dribbble.db    data/*.json          5 tabs
```

- `src/scraper/dribbble.ts` — Playwright scraper (opens each shot, clicks the
  public "Detail actions" button, reads `#details-modal`; sequential, polite
  delays, retries).
- `src/db.ts` — SQLite layer (`data/dribbble.db`): `profiles`, `shots`,
  `shot_history` (one row per shot per day — everything derives from this),
  `sync_logs`.
- `src/sync.ts` — the sync runner shared by the server, the CLI and CI.
- `server.ts` — Express API + React dashboard.
- `src/analytics.ts` — shared analytics engine · `src/dataQuality.ts` — day
  classification · `src/registryStore.ts` — shared cache for the two registries.
- `.github/workflows/daily-scrape.yml` — GitHub Actions runs the scraper daily
  at **23:50 Asia/Tehran** and commits the updated `data/` back to the repo.

Two registries sit alongside the scraped data and are owned by you, not inferred:

| File | What it holds |
|---|---|
| `data/collections.json` | Which shots belong to which project |
| `data/boosts.json` | Which shots were boosted or featured, and when |

Both are written by the app (Express API on a server, GitHub Contents API on
Pages) and committed by the daily workflow like every other file in `data/`.

## The five tabs

**Dashboard** — account totals, best-performing shots, and the full shot table
with search, tag filter, quick find, CSV export and per-shot history.

**Growth Analysis** — 17 charts in six sections, all driven by one date range,
one collection filter and one traffic filter.

**History** — the daily ledger with day-over-day change and badges that explain
every anomaly.

**Promotions** — record Boosted Shots and free features; see what each delivered
and its CTR; confirm or dismiss automatically detected spikes.

**Collections** — define which shots belong to which project.

## Growth Analysis

Every chart reads from one shared engine (`src/analytics.ts`) so the numbers
always agree with each other.

**Controls**
- **Range** — 7d / 14d / 30d / 90d / All / Custom.
- **Collections** — your own groups, from the Collections tab. Never guessed
  from shot titles.
- **Traffic** — `All`, `No paid` (drop Boosted Shots) or `Organic` (also drop
  free features), plus **Per campaign** to exclude one specific promotion.

**Sections**

| Section | Charts |
|---|---|
| Growth over time | Growth Trend · Traffic Attribution · Engagement Rate & Views |
| Momentum & pace | Where the Growth Came From · Momentum |
| Timing & rhythm | Best Days of the Week · Daily Activity Heatmap · Posting Cadence · Shot Lifecycle |
| Content & tags | Tag Performance Matrix · Shot Performance Matrix |
| Collections | Collection Performance · Views Split by Collection · Collection Breakdown |
| Portfolio shape | Portfolio Concentration · Engagement Mix · Top Shots |

Click any legend label to hide that series. Every card has a `?` with an
explanation; all copy lives in `src/helpTexts.ts`.

## Data quality

Not every logged day is a clean 24-hour reading, and using the bad ones invents
growth that never happened. `src/dataQuality.ts` classifies each day and
suppresses untrustworthy day-over-day changes centrally, so no chart can be
distorted by them:

- **Staggered capture** — the scraper read the shots over a long window that
  day, so the numbers come from different moments rather than one.
- **Partial window** — two runs landed close together, so the "day" covers only
  a few hours.

Totals for those days remain correct and are still shown; only their deltas are
ignored. The Analysis tab names the excluded days and the History tab badges
them.

## Promotions

Dribbble publishes no promotion flag, so two kinds are recorded by hand and kept
apart because they are not comparable:

- **Boosted (paid)** — you buy an impression budget for one shot and it runs
  until spent. Entering the impressions unlocks **CTR = views gained ÷
  impressions**.
- **Featured (free)** — exposure Dribbble gave you, such as Popular. No cost,
  but it inflates a shot just like a boost, so it is not organic either.

The dashboard also flags shots that gained at least five times their own median
daily views and asks you to classify the spike as paid, featured or organic.

## Collections

Project grouping is explicit. Create collections, assign shots, pick a colour —
that colour is used for the collection in every chart. **Suggest from titles**
pre-fills groups from the `Title | Project` pattern as a reviewable starting
point; nothing is saved until you press Save. Shots left ungrouped appear as
*Unassigned* and are excluded from collection charts rather than being guessed
into one.

## Performance

The analytics core is built for large profiles. Carry-forward alignment is
computed once per filter change and shared by every chart, promotion windows are
pre-indexed per shot, and the chart library ships as its own cached bundle.

| Workload | Full analytics pass |
|---|---|
| 70 shots × 16 days | ~10 ms |
| 1,000 shots × 90 days | ~156 ms |
| 1,000 shots × 365 days | ~369 ms |
| 2,000 shots × 365 days | ~810 ms |

Verify the maths against the committed snapshot at any time:

```bash
npm run verify
```

## Using it for another Dribbble account

The dashboard reads the tracked profile from `data/profiles.json`, and the
sidebar name, header and profile chip all derive from that URL — no code changes
needed to point it at a different account. Two things are still hardcoded and
would need editing: the login credential in `src/auth.ts` and the default
profile URL in `src/App.tsx`.

## Local development
```bash
npm install
npx playwright install chromium   # one-time browser download
npm run dev                       # http://localhost:3000
```

## CLI scrape (same thing CI runs)
```bash
npm run scrape                    # scrapes PROFILE_URL from .env / default
npm run scrape -- https://dribbble.com/someuser
```

## Daily scheduling via GitHub Actions (recommended)
Push this repo to GitHub — the workflow is already included:
- Runs daily at `50 23 * * *` (**UTC**; edit the cron in
  `.github/workflows/daily-scrape.yml` for your timezone — e.g. `20 20 * * *`
  for 23:50 Tehran time).
- Can also be triggered manually from the **Actions** tab (workflow_dispatch).
- Commits `data/dribbble.db` + JSON snapshots back to the repo, so your data
  history lives in git.
- After committing, it rebuilds and redeploys the GitHub Pages dashboard with
  the fresh data (bot pushes can't trigger other workflows, so this happens
  inside the same job).

Note: GitHub schedules can start a few minutes late under load — normal.

## Team dashboard on GitHub Pages (no server needed)
The dashboard has a **static mode** that reads the committed
`data/*.json` snapshots directly — perfect for sharing with the whole company:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Actions → General → Workflow permissions →
   "Read and write permissions"**.
3. Push to `main` (or run either workflow manually from the Actions tab).
4. Share the URL: `https://<username>.github.io/<repo-name>/`

In static mode the manual-sync button is replaced with an "auto-updates daily"
note; to force a refresh, run the **Daily Dribbble Scrape** workflow manually.

**Saving Promotions or Collections from a Pages deployment needs a token.**
There is no server to write the JSON, so the app commits it through the GitHub
Contents API. Create a fine-grained personal access token with
**Contents: Read and write** on this repository and paste it when the app asks —
it is stored only in your browser and sent only to `api.github.com`. Both pages
warn you up front if no token is stored yet. Without one, edits stay on your
device and no one else will see them.
If the repo is private, Pages visibility depends on your GitHub plan (public
Pages from private repos require Pro/Team) — making the repo public also works
since the data is public Dribbble stats anyway.

## Seeding initial data
Bootstrap the DB from a CSV made by the legacy Python scraper:
```bash
npm run seed -- path/to/dribbble_shots.csv
```
(This repo already ships with `data/` seeded from a real scrape, so the
dashboard shows data immediately.)

## Self-hosting the dashboard
```bash
docker compose up --build -d      # dashboard on :3000, health at /api/health
```
Pull the latest data committed by CI with a simple `git pull` on the server
(or enable `ENABLE_CRON=true` to let the server scrape on its own schedule).

Deploy targets: any VPS/Docker host, Render/Railway/Fly (Docker environment,
`PORT` is respected). Static-only hosts (Netlify/Vercel/GitHub Pages) cannot
run the server.
