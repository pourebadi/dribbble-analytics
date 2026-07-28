/**
 * Centralized help texts for every card in the dashboard.
 * Edit here to change (or translate) every tooltip in one place.
 */

export interface HelpText {
  title: string;
  body: string;
}

export const HELP: Record<string, HelpText> = {
  range: {
    title: 'Analysis range',
    body:
      'Every chart on this tab is computed over the selected date window of the daily log. ' +
      'Presets count back from the latest logged day; pick Custom for an exact window. ' +
      'Dots in the calendar mark days that have logged data.',
  },
  collections: {
    title: 'Collections filter',
    body:
      'Narrow the whole analysis to one client/project (detected from shot titles, e.g. "… | Dizno") ' +
      'or to a keyword collection such as "System" (every shot whose title contains that word). ' +
      'All charts below react to this filter.',
  },
  excludeBoosted: {
    title: 'Traffic filter',
    body:
      'Chooses which promoted traffic every chart should ignore. "All" uses the raw numbers. ' +
      '"No paid" removes only paid Boosted Shots — useful for judging what your money bought. ' +
      '"Organic" also removes free editorial features (Popular, Dribbble picks), leaving only traffic ' +
      'you earned without promotion. Time-series charts subtract just the gains earned inside each ' +
      'promotion window, while rankings and concentration drop the promoted shots entirely. ' +
      'Windows come from the ⚡ Promotions registry.',
  },
  attribution: {
    title: 'Traffic attribution',
    body:
      'Splits the growth in the selected range into three sources: Boosted (paid impressions you bought), ' +
      'Featured (free exposure Dribbble gave you), and Organic (everything else). This is the fastest way to ' +
      'answer "how much of our reach did we actually earn?". A day covered by both a boost and a feature is ' +
      'counted as paid, so the three bands always sum to the unfiltered daily gain. The chart only appears ' +
      'once at least one promotion is registered.',
  },
  kpis: {
    title: 'Gained in range',
    body:
      'How much each metric grew inside the selected window (end value minus the value on the day ' +
      'before the window). The small % compares this window against the previous window of equal length.',
  },
  growthTrend: {
    title: 'Growth trend',
    body:
      '"Daily gain" shows how much was earned each day — the most honest view of momentum. ' +
      '"Cumulative" shows the running total. The dashed line is a 7-day moving average that smooths ' +
      'day-to-day noise. Pink shading marks registered boost windows; amber shading marks automatically ' +
      'detected spikes that look like boosts but are not registered yet.',
  },
  engagement: {
    title: 'Engagement rate & views',
    body:
      'Bars show views gained per day; lines show what share of those views converted into interactions ' +
      '(likes + saves + comments) that same day. A high-view / low-rate day usually means paid or feed ' +
      'traffic (typical during boosts); a low-view / high-rate day means a smaller but highly engaged audience.',
  },
  bestDays: {
    title: 'Best days of the week',
    body:
      '"Weekly growth pattern" answers: on which weekday does the portfolio actually earn the most views ' +
      'and engagement? It is computed from the daily log (views gained on each Monday, Tuesday, …), not ' +
      'from publish dates. "n days sampled" tells you how many of that weekday are in the log so far — ' +
      'treat small samples with care. "By publish weekday" is the legacy view: average totals of shots ' +
      'grouped by the weekday they were published.',
  },
  heatmap: {
    title: 'Daily activity heatmap',
    body:
      'GitHub-style calendar of daily gains for the chosen metric: each column is a week (Mon→Sun top to ' +
      'bottom), darker pink = more gained that day. The dashed cell is the baseline (first logged day — ' +
      'no gain can be computed for it). A pink ring marks days inside a registered boost window; an amber ' +
      'ring marks automatically detected spike days.',
  },
  concentration: {
    title: 'Portfolio concentration',
    body:
      'The curve shows what share of total views comes from your top X% of shots (a Lorenz/Pareto view). ' +
      'A curve hugging the top-left corner means a few hero shots carry the portfolio — great reach, but ' +
      'fragile. Switch to "Organic only" to see the distribution without promoted shots; the difference ' +
      'between the two numbers tells you how much of the concentration was bought or gifted rather than earned.',
  },
  tagMatrix: {
    title: 'Tag performance matrix',
    body:
      'Each bubble is a tag used on 2+ shots. Horizontal: average views per shot carrying the tag (reach). ' +
      'Vertical: likes per 100 views (conversion). Bubble size: number of shots. Top-right = golden tags — ' +
      'they both reach and convert; consider using them more.',
  },
  topShots: {
    title: 'Top shots',
    body:
      '"Growth" ranks shots by how much they gained inside the selected range; "Total" ranks by all-time ' +
      'value. A ⚡ badge means the shot has a registered boost overlapping the range.',
  },
  projects: {
    title: 'Project performance',
    body:
      'Shots grouped by client/project (parsed from titles). "Gained" is views earned inside the selected ' +
      'range; Eng. rate = (likes + saves + comments) / views across the project.',
  },
  boosts: {
    title: 'Promotion registry',
    body:
      'Records the two ways a shot can get non-organic traffic. "Boosted (paid)" is a Dribbble Boosted Shot: ' +
      'you buy an impression budget (1,000–250,000) for one shot and it runs until the budget is spent, so ' +
      'log the start day and — once it stops — the end day. Adding the purchased impressions unlocks ' +
      'CTR (views gained ÷ impressions). "Featured (free)" is editorial or algorithmic exposure such as ' +
      'Popular or a category spotlight: no cost and no impression budget, but it inflates a shot just like a ' +
      'boost, so it must be tracked separately rather than mistaken for organic growth. ' +
      'The registry is saved to data/boosts.json in the repository so the whole team sees the same history.',
  },
  dashScraper: {
    title: 'Scraper status',
    body:
      'Result of the most recent sync: how many shots were discovered on the profile, how many were read ' +
      'successfully, and how many failed. Failures are usually timeouts on a single shot page and are retried ' +
      'on the next run; the previous values are kept so a failed shot never erases its data.',
  },
  dashLikes: {
    title: 'Total likes',
    body:
      'Sum of likes across every successfully scraped shot. The percentage underneath is the like rate ' +
      '(likes ÷ views) — how often a viewer liked what they saw. Likes can go down: Dribbble users can unlike, ' +
      'and removed accounts take their likes with them.',
  },
  dashViews: {
    title: 'Total reach',
    body:
      'Sum of views across every successfully scraped shot, plus the average per shot. This is an all-time ' +
      'cumulative number — use the Growth Analysis tab to see how much was earned in a specific period.',
  },
  dashSaves: {
    title: 'Saves',
    body:
      'How many times shots were saved to a Dribbble bucket. Saves are the strongest signal of intent — a ' +
      'viewer keeping the work for later — so a healthy save rate matters more than raw view counts.',
  },
  dashComments: {
    title: 'Comments',
    body: 'Total comments across all scraped shots — the most effortful form of engagement and the rarest.',
  },
  dashTable: {
    title: 'Creative items',
    body:
      'Every scraped shot with its current totals. Search by title, tag or URL, filter by tag, sort any column, ' +
      'and click a row to expand portfolio-relative context. "Export CSV" downloads exactly the rows currently ' +
      'shown after filtering.',
  },
  dataQuality: {
    title: 'Excluded start-up days',
    body:
      'Not every logged day is a clean 24-hour observation. Two defects are detected automatically and their ' +
      'day-over-day change is suppressed. "Staggered capture": on the first run the scraper worked through the ' +
      'shots slowly, so those numbers are snapshots of many different moments rather than one — 2026-07-13 spans ' +
      'over six hours. "Partial window": the next run happened only a few hours later but landed on the next ' +
      'calendar day in Tehran time, so its change covers a fraction of a day and absorbs the correction from the ' +
      'first run — which is exactly why it looked like a +20,000 view spike. Cumulative totals from those days are ' +
      'still valid and still displayed; only their deltas are ignored, by every chart, weekday bucket, heatmap ' +
      'cell and boost detector.',
  },
  lifecycle: {
    title: 'Shot lifecycle',
    body:
      'Every shot is aligned on its own publish date instead of the calendar, then grouped by age. Each bar is the ' +
      'average views a shot earned per day while it was that old. A steep drop after the first week means reach ' +
      'depends on the launch moment and posting cadence matters most; a flatter curve means older work keeps ' +
      'pulling traffic and quality compounds. Tooltips show how many shots and shot-days each bar is based on.',
  },
  momentum: {
    title: 'Momentum',
    body:
      'Splits the selected range in half and compares each shot\'s average daily views in the recent half against ' +
      'the earlier half. "Accelerating" shots are picking up speed — worth boosting or building on. "Cooling down" ' +
      'shots are past their peak, which is normal for older work but worth noticing if a shot is only days old. ' +
      'Excluded start-up days never enter this calculation.',
  },
  promoPaid: {
    title: 'Paid campaigns',
    body:
      'Dribbble Boosted Shots you paid for. The view figure is measured from the daily log inside each campaign ' +
      'window, not estimated — so it reflects what the promotion actually delivered.',
  },
  promoFeatured: {
    title: 'Features',
    body:
      'Free exposure Dribbble gave you (Popular, category spotlight, editorial pick). Tracked separately from paid ' +
      'boosts because it costs nothing and reflects merit, but it inflates a shot the same way — so it must not be ' +
      'counted as organic growth either.',
  },
  promoCtr: {
    title: 'Blended CTR',
    body:
      'Total views gained inside paid windows divided by total impressions bought, across all campaigns. It answers ' +
      '"of the people Dribbble showed my work to, how many actually opened it?". Only campaigns where you entered ' +
      'the purchased impressions contribute.',
  },
  promoDetected: {
    title: 'Detected spikes',
    body:
      'A shot gaining at least five times its own median daily views is flagged automatically. The data cannot say ' +
      'why it spiked, so you classify it: Paid, Featured, or Organic (dismiss). Days already excluded for data ' +
      'quality are never flagged, so the start-up artifact will not appear here.',
  },
  promoImpact: {
    title: 'Campaign impact',
    body:
      'Views and interactions measured inside each promotion window, taken from the daily log. Pink bars are paid ' +
      'campaigns, indigo bars are free features. Comparing interactions against views shows whether a campaign ' +
      'brought engaged viewers or just traffic.',
  },
  engagementMix: {
    title: 'Engagement mix',
    body:
      'How interactions split between likes, saves and comments. "Range" counts only what was gained inside the ' +
      'selected window — the honest read on current audience behaviour. "All-time" shows the portfolio totals. ' +
      'A high save share means people are keeping your work for reference, which is a stronger signal than a like. ' +
      'When the traffic filter is active, promoted shots are excluded from the all-time view and promoted gains ' +
      'from the range view.',
  },
  projectMatrix: {
    title: 'Project performance matrix',
    body:
      'Each bubble is a client project. Horizontal: average views per shot (reach). Vertical: engagement rate ' +
      '(likes + saves + comments ÷ views). Bubble size: how many shots the project has. The dashed lines are the ' +
      'portfolio averages, so the top-right quadrant holds the star projects that beat the average on both axes. ' +
      'Bottom-right projects get seen but do not convert; top-left convert well but need more reach.',
  },
  projectStack: {
    title: 'Views composition by project',
    body:
      'Stacked total views over time, split by project, for the top six projects. The thickness of each band shows ' +
      'how much of the portfolio each client carries, and whether that balance is shifting as new work lands. ' +
      'Needs at least two logged days in the selected range.',
  },
  cadence: {
    title: 'Posting cadence vs performance',
    body:
      'Bars are how many shots were published each month; the line is the average views those shots earned. ' +
      'Read them together: if the line falls as the bars rise, extra volume is diluting attention rather than ' +
      'compounding it. Note this uses all-time totals per shot, so recent months look lower simply because their ' +
      'shots have had less time to accumulate.',
  },
  velocity: {
    title: 'Period growth velocity',
    body:
      'Compares consecutive periods the same length as your selected range — current vs previous vs the one before ' +
      'that — to show whether momentum is building or fading. Views use the left axis and likes the right, because ' +
      'they differ by orders of magnitude. Excluded start-up days never contribute.',
  },
  tagRadar: {
    title: 'Top tags ROI',
    body:
      'The six tags with the highest total views, plotted by the likes they earned. A wide, even shape means your ' +
      'strong tags convert consistently; a spiky shape means one or two tags carry all the response. Pair it with ' +
      'the Tag Performance Matrix, which separates reach from conversion.',
  },
  shotMatrix: {
    title: 'Shot performance matrix',
    body:
      'Every shot plotted by views against likes (or saves). The diagonal cloud is normal behaviour: more reach, ' +
      'more response. What matters are the outliers — points high above the cloud converted unusually well for ' +
      'their reach and are worth studying or re-promoting, while points far right but low got traffic without ' +
      'response. Registered promotions are drawn in pink so bought reach is easy to spot.',
  },
  dashSpotlight: {
    title: 'Best performing shots',
    body:
      'The single strongest shot in each dimension across the whole portfolio, all-time. Most Viewed is pure reach; ' +
      'Most Liked shows what resonated; Most Saved is the strongest intent signal (someone kept it for later); ' +
      'Most Commented is the rarest, since commenting takes real effort. A shot leading views but absent from the ' +
      'others usually got traffic without connecting.',
  },
  dashMetadata: {
    title: 'Metadata summary',
    body:
      'Reference details for this shot. "Engagement conversion" is likes ÷ views. "First logged" is when the ' +
      'scraper first recorded the shot, which is not the same as its Dribbble publish date — shots published ' +
      'before tracking started were captured at their existing totals.',
  },
  dashShotHistory: {
    title: 'Shot performance over time',
    body:
      'Cumulative totals for this individual shot on each day it was logged. The line only rises because these are ' +
      'running counters. Two or more logged days are needed before a trend can be drawn. For growth *per day* and ' +
      'range comparisons, use the Growth Analysis tab.',
  },
  historyLedger: {
    title: 'Daily historical ledger',
    body:
      'One row per logged day with day-over-day deltas. Badges explain anomalies: "baseline" is the first ' +
      'log (no delta possible), ⚡ marks days with unusually high growth (possible boost/feature), and the ' +
      'unlike badge marks days where many shots each lost exactly one like — the signature of a single ' +
      'account removing its likes or being purged by Dribbble.',
  },
};
