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
      'Narrows every chart on this tab to one collection. Collections are the groupings you define yourself on ' +
      'the Collections page in the sidebar — they are never guessed from shot titles, because parsing titles ' +
      'silently mis-files anything that does not follow the naming convention and the reader has no way to tell. ' +
      '"Unassigned" gathers shots that are not in any collection yet. Use Manage to add, rename, recolour or ' +
      'reassign.',
  },
  collectionsPage: {
    title: 'Collections',
    body:
      'A collection is a project, client or any grouping you want to analyse together. The colour you pick here ' +
      'is the colour that collection uses in every chart. Deleting a collection never deletes shots — they simply ' +
      'become unassigned. Nothing is stored until you press Save collections, which writes ' +
      'data/collections.json to the repository so the whole team shares one grouping.',
  },
  collectionsAssign: {
    title: 'Assigning shots',
    body:
      'Click any shot to add or remove it. The list keeps its order while you work, so nothing moves under your ' +
      'cursor. Use the tabs to see only what is in the collection or only what is missing, then Add all / Remove ' +
      'to handle a whole search at once. A coloured badge means the shot is also in another collection — allowed, ' +
      'and charts credit it to the first one. "Suggest from titles" is a starting point you review, not an ' +
      'automatic classification.',
  },
  excludeBoosted: {
    title: 'Traffic filter',
    body:
      'Decides which promoted traffic the charts ignore. All = raw numbers. No paid = removes Boosted Shots, ' +
      'so you can see what your budget actually bought. Organic = also removes free exposure like Popular, ' +
      'leaving only reach you earned. Use Per campaign to exclude one specific boost or feature instead of a ' +
      'whole category.',
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
  kpi_views: {
    title: 'Views gained',
    body:
      'New views earned inside the selected window — the sum of each day\'s growth, not a cumulative total. ' +
      'The percentage compares this window against the immediately preceding window of the same length, so ' +
      '+12% means the portfolio earned 12% more views than in the equivalent previous period. Days excluded ' +
      'for data quality contribute nothing.',
  },
  kpi_likes: {
    title: 'Likes gained',
    body:
      'New likes earned in the window. This can be lower than expected, or even flat, because likes are ' +
      'reversible on Dribbble — a user unliking, or an account being removed, subtracts from the total. ' +
      'Compare it against views gained to judge whether new traffic is actually connecting.',
  },
  kpi_saves: {
    title: 'Saves gained',
    body:
      'New bucket saves in the window. Saves are the strongest intent signal available — someone filed your ' +
      'work away to come back to it. A rising save count alongside flat likes usually means the work is being ' +
      'treated as reference material rather than casual scrolling.',
  },
  kpi_comments: {
    title: 'Comments gained',
    body:
      'New comments in the window. This is the rarest metric because commenting takes the most effort, so ' +
      'small absolute numbers are normal and a single-digit change can still be meaningful.',
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
      'Dribbble does not publish which shots were promoted, so you record it here. Boosted (paid) is a Boosted ' +
      'Shot — you buy an impression budget for one shot and it runs until spent, so log the start day and the ' +
      'end day once it stops. Adding the impressions you bought unlocks CTR. Featured (free) is exposure ' +
      'Dribbble gave you, like Popular. Both inflate a shot, so neither should be read as organic growth.',
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
      'Some logged days are not clean 24-hour readings, and using them would invent growth that never happened. ' +
      'Staggered capture means the scraper read the shots slowly that day, so the numbers come from different ' +
      'moments rather than one. Partial window means two runs landed close together, so that day covers only a ' +
      'few hours. Totals for those days are still correct and still shown — only the day-over-day change is ' +
      'ignored, everywhere.',
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
      'Splits the date range in half and compares each shot\'s views per day in the recent half against the ' +
      'earlier half. Gaining pace means it is earning faster than before; losing pace means slower. The badge at ' +
      'the top shows the same for the whole account. Older shots naturally slow down once the launch buzz fades — ' +
      'a new shot slowing down is the one worth looking at.',
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
      'How the portfolio\'s attention is divided between the top six projects, day by day. ' +
      '"Share %" normalises every day to 100%, so a band widening genuinely means that project is taking a ' +
      'larger slice — this is the mode that answers "is the balance shifting?". "Absolute" shows raw stacked ' +
      'views, where every band grows simply because the counters do. Click any legend item to hide that project ' +
      'and compare the rest. Needs at least two logged days in the range.',
  },
  cadence: {
    title: 'Posting cadence vs performance',
    body:
      'Bars are how many shots were published each month; the line is what each one earns. Read them together: ' +
      'if the line falls as the bars rise, extra volume is diluting attention rather than compounding it. ' +
      '"Per day" divides each shot\'s views by how many days it has been live, which makes months comparable — ' +
      'without it, recent months always look worse purely because their shots are younger. "Lifetime" shows the ' +
      'raw totals if you want the unadjusted picture.',
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
  promoImpressions: {
    title: 'Impressions bought',
    body:
      'Total impression budget purchased across all registered paid campaigns. An impression is Dribbble showing ' +
      'your shot in a feed or search result — it is not a view. The gap between impressions and views is exactly ' +
      'what CTR measures, so entering this number is what makes campaign efficiency comparable.',
  },
  promoRegistry: {
    title: 'Registry',
    body:
      'Every promotion recorded for this profile. "Views gained" and "Interactions" are measured from the daily ' +
      'log inside each window — real numbers, not estimates — so a campaign with a blank end date keeps ' +
      'accumulating until you close it. Removing a row makes the affected days count as organic again across ' +
      'every chart. Changes only take effect once you press Save registry.',
  },
  dashViewsPerDay: {
    title: 'Views per day',
    body:
      'All-time views divided by how many days the shot has been live. It puts old and new shots on the same ' +
      'footing — a two-year-old shot with 20,000 views is earning far less per day than a two-week-old one with ' +
      '3,000. Use it to spot which work is still actively pulling traffic rather than just carrying a big total.',
  },
  dashRank: {
    title: 'Portfolio rank',
    body:
      'Where this shot sits when the whole portfolio is ordered by views, plus how it compares to the portfolio ' +
      'average. "2.4× portfolio avg" means it earned nearly two and a half times what a typical shot here earns. ' +
      'A handful of shots ranking far above average is normal — see Portfolio Concentration in Growth Analysis.',
  },
  dashEngagement: {
    title: 'Engagement',
    body:
      'Likes plus saves plus comments, divided by views — the share of viewers who did something rather than just ' +
      'scrolling past. It is reach-independent, so a small shot can beat a viral one here. A low rate on a ' +
      'high-view shot often points to feed or paid traffic rather than an audience that connected with the work.',
  },
  dashLastGain: {
    title: 'Last sync gain',
    body:
      'Views this shot picked up between the two most recent logged days. It needs at least two days of history, ' +
      'and it reads zero on a day whose scrape was excluded for data quality. For trends over a period rather ' +
      'than a single day, use the Growth Analysis tab.',
  },
  dashQuickFind: {
    title: 'Quick find',
    body:
      'Jump straight to a shot by searching its title, tag or project. Selecting one filters the table to it and ' +
      'opens its detail panel, which is faster than paging through the list when you know what you are looking for.',
  },
  legendToggle: {
    title: 'Hiding series',
    body:
      'Charts with several series can be hard to read at once. Click any legend label to hide that series and ' +
      'click again to bring it back — useful for isolating one line, or for removing a large series whose scale ' +
      'flattens the others. A "Show all series" button appears while anything is hidden.',
  },
  contribution: {
    title: 'Where the growth came from',
    body:
      'Top Shots ranks by size; this shows what share of the period\'s growth each shot was responsible for. ' +
      'Read the line at the bottom: if most growth came from the long tail, the account is earning broadly. ' +
      'If two or three shots produced nearly all of it — especially promoted ones — the period looks better ' +
      'than it is.',
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
