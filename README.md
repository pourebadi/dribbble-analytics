# Dribbble Analytics Dashboard

Tracks a Dribbble profile's shots (views / likes / saves / comments / tags),
logs a daily snapshot per shot into a **local SQLite database**, and serves a
React dashboard with growth analytics. No external services required.

## Architecture
- `src/scraper/dribbble.ts` — Playwright scraper (opens each shot, clicks the
  public "Detail actions" button, reads `#details-modal`; sequential, polite
  delays, retries).
- `src/db.ts` — SQLite layer (`data/dribbble.db`): `profiles`, `shots`,
  `shot_history` (one row per shot per day — everything derives from this),
  `sync_logs`.
- `src/sync.ts` — the sync runner shared by the server, the CLI, and CI.
- `server.ts` — Express API + React dashboard (Dashboard / History / Growth
  Analysis tabs, manual sync with live log console).
- `.github/workflows/daily-scrape.yml` — GitHub Actions runs the scraper every
  day at **23:50 UTC** and commits the updated `data/` back to the repo.

## Growth Analysis (rebuilt)
The **Growth Analysis** tab is driven by a shared analytics engine
(`src/analytics.ts`) so every chart uses the same carry-forward daily-log math:

- **Range engine** — 7d / 14d / 30d / 90d / All / Custom, applied to every chart.
- **Collections filter** — narrow everything to one client/project (parsed from
  the `Title | Project` naming convention) or to a keyword set such as every
  shot whose title contains *System*.
- **Promotion Registry** (`data/boosts.json`) — Dribbble exposes no promotion
  flag publicly, so the team records promoted shots by hand. Two kinds are
  tracked separately because they are not comparable:
  - **Boosted (paid)** — a bought impression budget (1,000–250,000) that runs
    until spent. Logging the purchased impressions unlocks
    **CTR = views gained in window ÷ impressions**.
  - **Featured (free)** — editorial or algorithmic exposure (Popular, category
    spotlight). No cost and no budget, but it inflates a shot exactly like a
    boost, so it must not be mistaken for organic growth. Optional *placement*
    field records where it was featured.

  The dashboard also **auto-detects** unregistered spikes (a shot gaining ≥5×
  its own median daily views) and offers them for one-click registration — you
  choose whether the spike was paid or featured.
- **Traffic filter** — `All` / `No paid` / `Organic`. Time-series charts subtract
  only the gains earned inside the relevant promotion windows; rankings and
  concentration drop the promoted shots entirely.
- **Traffic Attribution** — stacked split of range growth into
  Boosted / Featured / Organic, so "how much of our reach did we actually earn?"
  is answerable at a glance. Appears once a promotion is registered.
- **Growth Trend** — daily-gain vs cumulative modes, 7-bucket moving average,
  boost windows shaded on the chart, automatic weekly bucketing on long ranges.
- **Engagement Rate & Views** — dual axis: bars for views gained, lines for
  engagement / like / save rates, so paid traffic (high views, low rate) is
  visually distinct from organic traffic.
- **Best Days of the Week** — computed from *actual daily growth per weekday*
  (not publish dates), with Avg/Total and Views/Engagement toggles and a
  "limited data" warning while the log is still short. The legacy
  publish-weekday view is kept as a second mode.
- **Daily activity heatmap** — weekday + month labels, colour legend, metric
  picker, baseline marker and boost/spike rings.
- **Portfolio Concentration** — Lorenz/Pareto curve against a perfectly-even
  diagonal, with all-vs-organic comparison.
- **Tag Performance Matrix** — bubble chart of reach (avg views/shot) ×
  conversion (likes per 100 views) × usage (bubble size), plus a totals table.

The **History** tab now shows day-over-day deltas, the actual UTC run time of
each snapshot, and explanatory badges for anomalies (baseline day, unusual
growth, mass-unlike events, short scrape gaps).

Every card carries a `?` InfoTip; all help copy lives in `src/helpTexts.ts`.

Verify the analytics math against the committed snapshot at any time:
```bash
npm run verify
```

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
