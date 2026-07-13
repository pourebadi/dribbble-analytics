import React, { useMemo, useState } from 'react';
import { Shot, Profile } from '../types.ts';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, LineChart, Line, ComposedChart, Legend, ScatterChart, Scatter, ZAxis, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { startOfWeek, startOfMonth, format, parseISO } from 'date-fns';
import { 
  Eye, 
  Heart, 
  Bookmark, 
  MessageCircle, 
  Play, 
  RefreshCw, 
  Search, 
  ArrowUpDown, 
  ExternalLink, 
  Tag, 
  Filter, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  Info
} from 'lucide-react';

export function DashboardStats({ 
  shots, 
  activeProfile, 
  activeTab,
  onSync,
  isSyncing,
  profileManager
}: { 
  shots: Shot[]; 
  activeProfile: Profile | null; 
  activeTab: 'dashboard' | 'analysis' | 'history';
  onSync?: () => void;
  isSyncing?: boolean;
  profileManager?: React.ReactNode;
}) {
  
  // Table Interaction States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'likes' | 'views' | 'saves' | 'comments' | 'posted' | null>('likes');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedShotUrl, setExpandedShotUrl] = useState<string | null>(null);
  // Chart states
  const [chartMetric, setChartMetric] = useState<'likes' | 'views' | 'saves' | 'comments'>('views');
  const [chartViewMode, setChartViewMode] = useState<'trend' | 'distribution'>('trend');
  const [analysisRange, setAnalysisRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [topShotsMode, setTopShotsMode] = useState<'growth' | 'total'>('growth');

  // Helper to safely format a human title from shot
  const getShotTitle = (shot: Shot) => {
    if (shot.title) return shot.title;
    try {
      const parts = new URL(shot.url).pathname.split('/');
      const slug = parts[parts.length - 1];
      return slug.replace(/^\d+-/, '').replace(/-/g, ' ');
    } catch {
      return 'Untitled Dribbble Shot';
    }
  };

  const validShots = useMemo(() => {
    if (!Array.isArray(shots)) return [];
    const seen = new Set<string>();
    return shots.filter(s => {
      if (!s || s.status !== 'ok' || !s.url) return false;
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }, [shots]);

  // General Engagement Metrics
  const stats = useMemo(() => {
    return validShots.reduce((acc, shot) => ({
      views: acc.views + (shot.views || 0),
      likes: acc.likes + (shot.likes || 0),
      saves: acc.saves + (shot.saves || 0),
      comments: acc.comments + (shot.comments || 0),
      total: acc.total + 1,
    }), { views: 0, likes: 0, saves: 0, comments: 0, total: 0 });
  }, [validShots]);

  const averages = useMemo(() => {
    if (validShots.length === 0) return { likesRate: '0%', savesRate: '0%', avgViews: 0 };
    const totalViews = stats.views || 1;
    return {
      likesRate: ((stats.likes / totalViews) * 100).toFixed(2) + '%',
      savesRate: ((stats.saves / totalViews) * 100).toFixed(2) + '%',
      avgViews: Math.round(stats.views / validShots.length)
    };
  }, [validShots, stats]);

  // Spotlight / Top Shots
  const topShots = useMemo(() => {
    if (validShots.length === 0) return { views: null, likes: null, saves: null, comments: null };
    return {
      views: [...validShots].sort((a, b) => (b.views || 0) - (a.views || 0))[0],
      likes: [...validShots].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0],
      saves: [...validShots].sort((a, b) => (b.saves || 0) - (a.saves || 0))[0],
      comments: [...validShots].sort((a, b) => (b.comments || 0) - (a.comments || 0))[0],
    };
  }, [validShots]);

  const renderSpotlight = (shot: Shot | null, title: string, subtitle: string, colorClass: string) => {
    if (!shot) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-xs font-bold ${colorClass} px-2.5 py-1 rounded-full flex items-center gap-1`}>
              <Sparkles className="w-3.5 h-3.5" />
              {title}
            </span>
            <span className="text-[10px] text-slate-400">{subtitle}</span>
          </div>
          
          <div className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-100 border border-slate-100 mb-4 shadow-inner">
            {shot.imageUrl ? (
              <img 
                src={shot.imageUrl} 
                alt={getShotTitle(shot)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                No Preview
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
              <h4 className="text-xs font-semibold text-white truncate">{getShotTitle(shot)}</h4>
              <p className="text-[10px] text-slate-200 mt-0.5 font-mono">Posted: {shot.posted || 'Unknown'}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{getShotTitle(shot)}</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-[10px] text-slate-400">Views</p>
                  <p className="font-semibold text-slate-700">{(shot.views || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                <div>
                  <p className="text-[10px] text-slate-400">Likes</p>
                  <p className="font-semibold text-slate-700">{(shot.likes || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-purple-500 fill-purple-500" />
                <div>
                  <p className="text-[10px] text-slate-400">Saves</p>
                  <p className="font-semibold text-slate-700">{(shot.saves || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-[10px] text-slate-400">Comments</p>
                  <p className="font-semibold text-slate-700">{(shot.comments || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <a 
          href={shot.url} 
          target="_blank" 
          rel="noreferrer"
          className="mt-5 w-full flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Original Shot
        </a>
      </div>
    );
  };

  // Unique Tags list for filter dropdown
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    validShots.forEach(s => {
      if (Array.isArray(s.tags)) {
        s.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet).sort();
  }, [validShots]);

  // Sort and Filter logic for table
  const filteredShots = useMemo(() => {
    let result = [...validShots];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(shot => {
        const title = getShotTitle(shot).toLowerCase();
        const tags = (shot.tags || []).join(' ').toLowerCase();
        const url = shot.url.toLowerCase();
        return title.includes(q) || tags.includes(q) || url.includes(q);
      });
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter(shot => shot.tags && shot.tags.includes(selectedTag));
    }

    // Sorting
    if (sortBy) {
      result.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortBy === 'posted') {
          valA = a.posted ? new Date(a.posted).getTime() : 0;
          valB = b.posted ? new Date(b.posted).getTime() : 0;
        } else {
          valA = a[sortBy] || 0;
          valB = b[sortBy] || 0;
        }

        if (sortOrder === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
    }

    return result;
  }, [validShots, searchQuery, selectedTag, sortBy, sortOrder]);

  // Pagination calculations
  const paginatedShots = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredShots.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredShots, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredShots.length / itemsPerPage) || 1;

  // Aggregate account metrics over time (from history).
  // CARRY-FORWARD: for every date on the timeline, each shot contributes its
  // most recent known value up to that date. Without this, a shot that has no
  // history entry on a given day (e.g. its scrape failed that day) would drop
  // out of that day's total and create a fake dip in every chart.
  const profileHistory = useMemo(() => {
    // 1. Union of all dates across all shots
    const dateSet = new Set<string>();
    validShots.forEach(shot => {
      if (Array.isArray(shot.history)) {
        shot.history.forEach((h: any) => {
          if (h && h.date) dateSet.add(h.date);
        });
      }
    });
    const dates = Array.from(dateSet).sort();

    // If no history exists yet on any shots, seed today's totals to show a starting data point
    if (dates.length === 0) {
      if (validShots.length === 0) return [];
      const todayStr = new Date().toISOString().split('T')[0];
      return [{
        date: todayStr,
        timestamp: Date.now(),
        views: stats.views,
        likes: stats.likes,
        saves: stats.saves,
        comments: stats.comments,
        shotsCount: validShots.length
      }];
    }

    // 2. Build the timeline
    const result = dates.map(date => ({
      date,
      timestamp: new Date(date).getTime(),
      views: 0,
      likes: 0,
      saves: 0,
      comments: 0,
      shotsCount: 0
    }));

    // 3. Accumulate each shot with carry-forward of its last known values
    validShots.forEach(shot => {
      const hist = (Array.isArray(shot.history) ? shot.history : [])
        .filter((h: any) => h && h.date)
        .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
      if (hist.length === 0) return;

      let hi = 0;
      let last: any = null;
      for (const point of result) {
        while (hi < hist.length && hist[hi].date <= point.date) {
          last = hist[hi];
          hi++;
        }
        if (last) {
          point.views += last.views || 0;
          point.likes += last.likes || 0;
          point.saves += last.saves || 0;
          point.comments += last.comments || 0;
          point.shotsCount += 1;
        }
      }
    });

    return result;
  }, [validShots, stats]);

  // Individual Shot Comparison Chart Data: Top 12 shots based on the chosen chosen metric
  const comparisonChartData = useMemo(() => {
    return [...validShots]
      .sort((a, b) => (b[chartMetric] || 0) - (a[chartMetric] || 0))
      .slice(0, 12)
      .map(shot => ({
        name: getShotTitle(shot).substring(0, 15) + (getShotTitle(shot).length > 15 ? '...' : ''),
        value: shot[chartMetric] || 0,
        views: shot.views || 0,
        likes: shot.likes || 0,
        saves: shot.saves || 0,
        comments: shot.comments || 0,
      }));
  }, [validShots, chartMetric]);

  // Aggregate values formatted for Recharts Timeline
  const timelineChartData = useMemo(() => {
    return profileHistory.map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item[chartMetric] || 0,
      views: item.views,
      likes: item.likes,
      saves: item.saves,
      comments: item.comments
    }));
  }, [profileHistory, chartMetric]);

  const handleSort = (field: 'likes' | 'views' | 'saves' | 'comments' | 'posted') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setSortBy('likes');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (filteredShots.length === 0) return;
    const headers = ['Title', 'Dribbble URL', 'Posted Date', 'Views', 'Likes', 'Saves', 'Comments', 'Tags'];
    const rows = filteredShots.map(shot => [
      `"${getShotTitle(shot).replace(/"/g, '""')}"`,
      shot.url,
      shot.posted || '',
      shot.views || 0,
      shot.likes || 0,
      shot.saves || 0,
      shot.comments || 0,
      `"${(shot.tags || []).join(', ')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dribbble_analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (activeTab === 'analysis') {
    // Generate aggregated data for Analysis Dashboard
    const sortedHistory = [...profileHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group history data. Because sortedHistory is chronological and each
    // assignment overwrites the bucket, every week/month bucket ends up holding
    // the LAST daily snapshot of that period (end-of-period snapshot) — the
    // correct way to derive weekly/monthly snapshots from daily data.
    // Bucket keys are full ISO dates so different years can never collide.
    const weeklyData: Record<string, any> = {};
    const monthlyData: Record<string, any> = {};

    sortedHistory.forEach(h => {
      try {
        const d = parseISO(h.date);

        // Weekly (key = ISO date of week start, label = "Week of MMM dd")
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        weeklyData[weekKey] = { name: `W/${format(weekStart, 'MMM dd')}`, Views: h.views, Likes: h.likes, Saves: h.saves, Comments: h.comments };

        // Monthly
        const monthStart = startOfMonth(d);
        const monthKey = format(monthStart, 'yyyy-MM');
        monthlyData[monthKey] = { name: format(monthStart, 'MMM yyyy'), Views: h.views, Likes: h.likes, Saves: h.saves, Comments: h.comments };
      } catch (e) {
        // Ignore invalid dates
      }
    });

    const sortedBucketValues = (obj: Record<string, any>) =>
      Object.keys(obj).sort().map(k => obj[k]);

    const timeLabels = {
      daily: sortedHistory.slice(-14).map(h => {
        try {
          return { name: format(parseISO(h.date), 'MMM dd'), Views: h.views, Likes: h.likes, Saves: h.saves, Comments: h.comments };
        } catch {
          return { name: h.date, Views: h.views, Likes: h.likes, Saves: h.saves, Comments: h.comments };
        }
      }),
      weekly: sortedBucketValues(weeklyData).slice(-12),
      monthly: sortedBucketValues(monthlyData).slice(-12)
    };

    const currentChartData = timeLabels[analysisRange];

    // ------------------------------------------------------------------
    // TOP SHOTS per selected range.
    // Growth = value now − value at the start of the window (carry-forward
    // per shot: latest history entry ≤ cutoff; if the shot wasn't tracked
    // before the window, its first entry is used as the baseline, i.e.
    // growth since tracking began).
    // ------------------------------------------------------------------
    const windowDays = analysisRange === 'daily' ? 1 : analysisRange === 'weekly' ? 7 : 30;
    const latestDateStr = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].date : new Date().toISOString().split('T')[0];
    const cutoffDate = new Date(new Date(latestDateStr).getTime() - windowDays * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const metricDefs: { key: 'views' | 'likes' | 'saves' | 'comments'; label: string; color: string; Icon: any }[] = [
      { key: 'views', label: 'Most Viewed Shots', color: '#3B82F6', Icon: Eye },
      { key: 'likes', label: 'Most Liked Shots', color: '#EA4C89', Icon: Heart },
      { key: 'saves', label: 'Most Saved Shots', color: '#8B5CF6', Icon: Bookmark },
      { key: 'comments', label: 'Most Commented Shots', color: '#10B981', Icon: MessageCircle },
    ];

    const shotGrowthList = validShots.map(shot => {
      const hist = (Array.isArray(shot.history) ? shot.history : [])
        .filter((h: any) => h && h.date)
        .sort((a: any, b: any) => (a.date < b.date ? -1 : 1));

      const nowEntry = hist.length > 0
        ? hist[hist.length - 1]
        : { views: shot.views || 0, likes: shot.likes || 0, saves: shot.saves || 0, comments: shot.comments || 0 };

      let baseEntry: any = null;
      for (const h of hist) {
        if (h.date <= cutoffStr) baseEntry = h;
        else break;
      }
      if (!baseEntry) baseEntry = hist.length > 0 ? hist[0] : nowEntry;

      const growth: Record<string, number> = {};
      const totals: Record<string, number> = {};
      (['views', 'likes', 'saves', 'comments'] as const).forEach(m => {
        totals[m] = nowEntry[m] || 0;
        growth[m] = Math.max(0, (nowEntry[m] || 0) - (baseEntry[m] || 0));
      });

      return { shot, growth, totals };
    });

    const topShotsFor = (metric: 'views' | 'likes' | 'saves' | 'comments') => {
      const source = topShotsMode === 'growth' ? 'growth' : 'totals';
      return [...shotGrowthList]
        .sort((a, b) => (b[source][metric] || 0) - (a[source][metric] || 0))
        .slice(0, 8)
        .map(({ shot, growth, totals }) => ({
          name: getShotTitle(shot).substring(0, 22) + (getShotTitle(shot).length > 22 ? '…' : ''),
          fullName: getShotTitle(shot),
          value: topShotsMode === 'growth' ? growth[metric] : totals[metric],
          gained: growth[metric],
          total: totals[metric],
          url: shot.url,
        }));
    };

    const rangeWindowLabel = analysisRange === 'daily' ? 'last day' : analysisRange === 'weekly' ? 'last 7 days' : 'last 30 days';

    // Calculate Velocity (Growth Delta)
    const velocityData = currentChartData.map((data, index) => {
      if (index === 0) return { name: data.name, NewViews: 0, NewLikes: 0 };
      const prev = currentChartData[index - 1];
      return {
        name: data.name,
        NewViews: Math.max(0, data.Views - prev.Views),
        NewLikes: Math.max(0, data.Likes - prev.Likes)
      };
    });

    // --- Engagement Rate Trend: how well views convert to interactions over time ---
    const engagementRateTrend = currentChartData.map((d: any) => {
      const interactions = (d.Likes || 0) + (d.Saves || 0) + (d.Comments || 0);
      return {
        name: d.name,
        EngagementRate: d.Views > 0 ? +(interactions / d.Views * 100).toFixed(2) : 0,
        LikeRate: d.Views > 0 ? +((d.Likes || 0) / d.Views * 100).toFixed(2) : 0,
        SaveRate: d.Views > 0 ? +((d.Saves || 0) / d.Views * 100).toFixed(2) : 0,
      };
    });

    // --- Best Posting Days: average performance by weekday of publication ---
    const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekdayAgg: Record<string, { views: number; likes: number; count: number }> = {};
    weekdayNames.forEach(w => { weekdayAgg[w] = { views: 0, likes: 0, count: 0 }; });
    validShots.forEach(shot => {
      if (!shot.posted) return;
      const d = new Date(shot.posted);
      if (isNaN(d.getTime())) return;
      const w = weekdayNames[(d.getDay() + 6) % 7]; // JS Sunday=0 → Mon-first
      weekdayAgg[w].views += shot.views || 0;
      weekdayAgg[w].likes += shot.likes || 0;
      weekdayAgg[w].count += 1;
    });
    const postingDayData = weekdayNames.map(w => ({
      name: w,
      AvgViews: weekdayAgg[w].count > 0 ? Math.round(weekdayAgg[w].views / weekdayAgg[w].count) : 0,
      AvgLikes: weekdayAgg[w].count > 0 ? Math.round(weekdayAgg[w].likes / weekdayAgg[w].count) : 0,
      Posts: weekdayAgg[w].count,
    }));
    const hasPostedDates = postingDayData.some(d => d.Posts > 0);

    // --- Posting Cadence vs Performance: shots published per month + avg views each ---
    const cadenceAgg: Record<string, { views: number; likes: number; count: number; ts: number }> = {};
    validShots.forEach(shot => {
      if (!shot.posted) return;
      const d = new Date(shot.posted);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!cadenceAgg[key]) cadenceAgg[key] = { views: 0, likes: 0, count: 0, ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
      cadenceAgg[key].views += shot.views || 0;
      cadenceAgg[key].likes += shot.likes || 0;
      cadenceAgg[key].count += 1;
    });
    const postingCadenceData = Object.entries(cadenceAgg)
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(-12)
      .map(([key, v]) => ({
        name: format(new Date(v.ts), 'MMM yy'),
        Posts: v.count,
        AvgViews: Math.round(v.views / v.count),
        AvgLikes: Math.round(v.likes / v.count),
      }));

    const tagStats: Record<string, { views: number; likes: number }> = {};
    validShots.forEach(shot => {
      (shot.tags || []).forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { views: 0, likes: 0 };
        tagStats[tag].views += shot.views || 0;
        tagStats[tag].likes += shot.likes || 0;
      });
    });

    const topTags = Object.entries(tagStats)
      .sort((a, b) => b[1].likes - a[1].likes)
      .slice(0, 5)
      .map(([name, data]) => ({ name, Likes: data.likes, Views: data.views }));

    return (
      <div className="space-y-6">
        {/* Header & Range Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-5 rounded-2xl shadow-sm gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-pink-50 p-2.5 rounded-xl text-pink-500">
               <TrendingUp className="w-6 h-6" />
             </div>
             <div>
               <h3 className="font-bold text-slate-800 text-base">Management & Growth Analysis Dashboard</h3>
               <p className="text-xs text-slate-500 font-medium">Detailed tracking of Key Performance Indicators (KPIs) for the social team</p>
             </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/50">
             {['daily', 'weekly', 'monthly'].map(range => (
               <button 
                  key={range}
                  onClick={() => setAnalysisRange(range as any)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg capitalize transition-all ${analysisRange === range ? 'bg-white shadow-sm text-pink-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 {range}
               </button>
             ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Velocity ({analysisRange})</span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{velocityData.length > 0 ? velocityData[velocityData.length - 1].NewViews.toLocaleString() : 0}</div>
              <p className="text-xs font-semibold text-slate-400 mt-1">New views acquired</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engagement Delta</span>
              <div className="p-1.5 bg-pink-50 text-pink-600 rounded-lg"><Heart className="w-4 h-4" /></div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{velocityData.length > 0 ? velocityData[velocityData.length - 1].NewLikes.toLocaleString() : 0}</div>
              <p className="text-xs font-semibold text-slate-400 mt-1">New likes acquired</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conversion Health</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Sparkles className="w-4 h-4" /></div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{stats.views > 0 ? ((stats.likes / stats.views) * 100).toFixed(1) : 0}%</div>
              <p className="text-xs font-semibold text-slate-400 mt-1">Overall View-to-Like Ratio</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between border-l-4 border-l-violet-500">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deep Retention</span>
              <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg"><Bookmark className="w-4 h-4" /></div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{stats.likes > 0 ? ((stats.saves / stats.likes) * 100).toFixed(1) : 0}%</div>
              <p className="text-xs font-semibold text-slate-400 mt-1">Save-to-Like Ratio</p>
            </div>
          </div>
        </div>

        {/* ===== Overall Metric Snapshots (daily-logged, weekly/monthly derived) ===== */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Overall Snapshot — Views / Likes / Saves / Comments</h4>
              <p className="text-[11px] text-slate-500">Cumulative account totals per {analysisRange === 'daily' ? 'day' : analysisRange === 'weekly' ? 'week (end-of-week snapshot)' : 'month (end-of-month snapshot)'} — derived from the daily log</p>
            </div>
            <div className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-md border border-pink-100">
              Snapshot
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {([
              { dataKey: 'Views', color: '#3B82F6', Icon: Eye },
              { dataKey: 'Likes', color: '#EA4C89', Icon: Heart },
              { dataKey: 'Saves', color: '#8B5CF6', Icon: Bookmark },
              { dataKey: 'Comments', color: '#10B981', Icon: MessageCircle },
            ] as const).map(({ dataKey, color, Icon }) => (
              <div key={dataKey} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ background: `${color}15`, color }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{dataKey}</span>
                  </div>
                  <span className="text-sm font-black text-slate-800 font-mono">
                    {(currentChartData.length > 0 ? (currentChartData[currentChartData.length - 1] as any)[dataKey] || 0 : 0).toLocaleString()}
                  </span>
                </div>
                <div className="h-[160px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={currentChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`snapGrad_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={45} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fillOpacity={1} fill={`url(#snapGrad_${dataKey})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Top Shots Rankings (per selected range) ===== */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Top Shots — {topShotsMode === 'growth' ? `Gained in ${rangeWindowLabel}` : 'All-time totals'}</h4>
              <p className="text-[11px] text-slate-500">
                {topShotsMode === 'growth'
                  ? `Shots ranked by how much they gained over the ${rangeWindowLabel} (from the daily log)`
                  : 'Shots ranked by their current cumulative totals'}
              </p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start">
              {([
                { key: 'growth', label: `Growth (${analysisRange})` },
                { key: 'total', label: 'Total' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setTopShotsMode(opt.key)}
                  className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${topShotsMode === opt.key ? 'bg-white shadow-sm text-pink-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metricDefs.map(({ key, label, color, Icon }) => {
              const data = topShotsFor(key);
              return (
                <div key={key} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg" style={{ background: `${color}15`, color }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{label}</span>
                  </div>
                  {data.every(d => d.value === 0) ? (
                    <div className="h-[260px] flex items-center justify-center text-xs text-slate-400 font-medium">
                      No {topShotsMode === 'growth' ? `growth recorded in the ${rangeWindowLabel} yet` : 'data yet'} — run more daily syncs.
                    </div>
                  ) : (
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                          <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                          <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                            formatter={(_value: any, _name: any, entry: any) => {
                              const p = entry?.payload;
                              if (!p) return [_value, ''];
                              return [
                                `${(topShotsMode === 'growth' ? p.gained : p.total).toLocaleString()} (${topShotsMode === 'growth' ? `total: ${p.total.toLocaleString()}` : `gained ${rangeWindowLabel}: ${p.gained.toLocaleString()}`})`,
                                label,
                              ];
                            }}
                            labelFormatter={(l: any, payload: any) => payload?.[0]?.payload?.fullName || l}
                          />
                          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BI Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Main Growth Timeline */}
           <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="mb-6">
               <h4 className="font-bold text-slate-800 text-sm">Integrated Growth Trend</h4>
               <p className="text-[11px] text-slate-500">Comparison of views and interactions across {analysisRange} range</p>
             </div>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={currentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                     labelClassName="font-bold text-slate-800"
                   />
                   <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                   <Line yAxisId="left" type="monotone" dataKey="Views" name="Views" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                   <Line yAxisId="right" type="monotone" dataKey="Likes" name="Likes" stroke="#EA4C89" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Engagement Rate Trend (replaces the old Conversion Funnel) */}
           <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
             <div className="mb-2">
               <h4 className="font-bold text-slate-800 text-sm">Engagement Rate Trend</h4>
               <p className="text-[11px] text-slate-500">Interactions (likes + saves + comments) as % of views per {analysisRange} snapshot</p>
             </div>
             <div className="flex-1 min-h-[250px] relative pt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={engagementRateTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%" />
                   <Tooltip
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                     formatter={(v: any) => `${v}%`}
                   />
                   <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                   <Line type="monotone" dataKey="EngagementRate" name="Total Engagement" stroke="#EA4C89" strokeWidth={2.5} dot={{ r: 3 }} />
                   <Line type="monotone" dataKey="LikeRate" name="Like Rate" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                   <Line type="monotone" dataKey="SaveRate" name="Save Rate" stroke="#10B981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
             <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 font-medium">
               A falling rate while views grow = reach outpacing content resonance. A rising rate = stronger creative fit.
             </p>
           </div>

           {/* Best Posting Days (for the social team) */}
           <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h4 className="font-bold text-slate-800 text-sm">Best Posting Days</h4>
                 <p className="text-[11px] text-slate-500">Average views & likes per shot by the weekday it was published</p>
               </div>
               <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                 Social Team
               </div>
             </div>
             {!hasPostedDates ? (
               <div className="h-[250px] flex items-center justify-center text-xs text-slate-400 font-medium">
                 No parsable publish dates yet — run a sync to populate this chart.
               </div>
             ) : (
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={postingDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                     <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                     <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                     <Tooltip
                       cursor={{ fill: '#f8fafc' }}
                       contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                       formatter={(v: any, name: any, entry: any) => {
                         if (name === 'Avg Views' || name === 'Avg Likes') return [Number(v).toLocaleString(), `${name} (${entry?.payload?.Posts || 0} posts)`];
                         return [v, name];
                       }}
                     />
                     <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                     <Bar yAxisId="left" dataKey="AvgViews" name="Avg Views" fill="#60A5FA" radius={[4, 4, 0, 0]} maxBarSize={36} />
                     <Bar yAxisId="right" dataKey="AvgLikes" name="Avg Likes" fill="#F472B6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             )}
           </div>

           {/* Posting Cadence vs Performance (for management) */}
           <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h4 className="font-bold text-slate-800 text-sm">Posting Cadence vs Performance</h4>
                 <p className="text-[11px] text-slate-500">Shots published per month vs avg views each earned</p>
               </div>
             </div>
             <div className="flex-1 min-h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <ComposedChart data={postingCadenceData} margin={{ top: 10, right: -10, left: -25, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                   <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} allowDecimals={false} />
                   <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                   <Tooltip
                     cursor={{ fill: '#f8fafc' }}
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                   />
                   <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                   <Bar yAxisId="left" dataKey="Posts" name="Posts Published" fill="#C4B5FD" radius={[4, 4, 0, 0]} maxBarSize={24} />
                   <Line yAxisId="right" type="monotone" dataKey="AvgViews" name="Avg Views / Post" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />
                 </ComposedChart>
               </ResponsiveContainer>
             </div>
             <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 font-medium">
               Answers "does posting more often pay off?" — compare cadence against per-post returns.
             </p>
           </div>

           {/* Top Performing Tags Radar Chart */}
           <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h4 className="font-bold text-slate-800 text-sm">Top Tags ROI</h4>
                 <p className="text-[11px] text-slate-500">Highest yielding tags</p>
               </div>
             </div>
             <div className="flex-1 w-full relative min-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="70%" data={topTags}>
                   <PolarGrid stroke="#f1f5f9" />
                   <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                   <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                   <Radar name="Likes" dataKey="Likes" stroke="#EA4C89" fill="#EA4C89" fillOpacity={0.4} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                   />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Velocity Chart (Delta Growth) */}
           <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h4 className="font-bold text-slate-800 text-sm">Period Growth Velocity</h4>
                 <p className="text-[11px] text-slate-500">Net acquisition of views and likes per new time range</p>
               </div>
               <div className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md border border-violet-100">
                 Momentum
               </div>
             </div>
             <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <Tooltip 
                     cursor={{ fill: '#f8fafc' }}
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                   />
                   <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                   <Bar dataKey="NewLikes" name="New Likes" fill="#F472B6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                   <Bar dataKey="NewViews" name="New Views" fill="#60A5FA" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={40} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Shot Performance Scatter Matrix */}
           <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h4 className="font-bold text-slate-800 text-sm">Shot Performance Matrix</h4>
                 <p className="text-[11px] text-slate-500">Scatter of posts by likes and views to identify viral content</p>
               </div>
               <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                 Content Quality
               </div>
             </div>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                   <XAxis type="number" dataKey="views" name="Views" unit=" views" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <YAxis type="number" dataKey="likes" name="Likes" unit=" likes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                   <ZAxis type="number" range={[50, 400]} />
                   <Tooltip 
                     cursor={{ strokeDasharray: '3 3' }}
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: '#fff', fontSize: '12px' }}
                     formatter={(value, name) => [value, name === 'views' ? 'Views' : 'Likes']}
                     labelFormatter={() => ''}
                   />
                   <Scatter name="Shots" data={validShots} fill="#EA4C89" fillOpacity={0.6} />
                 </ScatterChart>
               </ResponsiveContainer>
             </div>
           </div>
           
        </div>
      </div>
    );
  }

  if (activeTab === 'history') {
    return (
      <div className="space-y-6">
        {/* Daily Aggregates Historical Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-slate-800 text-base">Daily Historical Ledger</h3>
            <p className="text-xs text-slate-500 font-medium">Observe overall profile growth and metrics by day</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold text-[11px] uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-center">Active Shots</th>
                  <th className="px-6 py-4 text-right">Total Views</th>
                  <th className="px-6 py-4 text-right">Total Likes</th>
                  <th className="px-6 py-4 text-right">Total Saves</th>
                  <th className="px-6 py-4 text-right">Total Comments</th>
                  <th className="px-6 py-4 text-right">Engagement Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profileHistory.slice().reverse().map((day, idx) => {
                  const engagementRate = day.views ? ((day.likes / day.views) * 100).toFixed(2) + '%' : '0%';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/40 transition-colors font-medium">
                      <td className="px-6 py-4 text-slate-800 font-bold font-mono">
                        {day.date}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 font-semibold font-mono">
                        {day.shotsCount || validShots.length}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600 font-mono">
                        {day.views.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-pink-600 font-mono">
                        {day.likes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-purple-600 font-mono">
                        {day.saves.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-700 font-mono">
                        {day.comments.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600 font-mono">
                        {engagementRate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render default Dashboard Tab
  return (
    <div className="space-y-6">
      
      {profileManager}

      {/* Database Sync Actions */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col">
           <h3 className="text-sm font-bold text-slate-800">Database Sync Status</h3>
           <p className="text-xs text-slate-500 mt-1">To prevent Firebase limitations, data is cached. Sync to receive the latest information.</p>
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Receiving...' : 'Sync with Database'}
        </button>
      </div>

      {/* Stats Cards Dashboard */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Scraper Run Success / Failure Analytics Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-pink-500/5 rounded-bl-full pointer-events-none group-hover:bg-pink-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-pink-50 text-pink-500 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">Scraper Status</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">Status of Last Run</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Collected:</span>
              <span className="font-bold text-slate-700 font-mono">
                {activeProfile?.lastRunStats?.total ?? stats.total}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Succeeded:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {activeProfile?.lastRunStats?.successCount ?? stats.total}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Failed:</span>
              <span className={`font-bold font-mono ${
                (activeProfile?.lastRunStats?.failedCount ?? 0) > 0 ? 'text-red-500' : 'text-slate-500'
              }`}>
                {activeProfile?.lastRunStats?.failedCount ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Total Likes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-pink-500/5 rounded-bl-full pointer-events-none group-hover:bg-pink-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-pink-50 text-pink-500 rounded-xl">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">Likes</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">Total Scraped Likes</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stats.likes.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            {averages.likesRate} engagement rate
          </p>
        </div>

        {/* Total Views */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-500/5 rounded-bl-full pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl">
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Reach</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">Total Reach / Views</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stats.views.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-2">
            Average of <span className="font-semibold text-slate-600">{averages.avgViews.toLocaleString()}</span> views / shot
          </p>
        </div>

        {/* Saved Assets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-purple-50 text-purple-500 rounded-xl">
              <Bookmark className="w-5 h-5 fill-current" />
            </div>
            <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">Saves</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">Saved Assets / Buckets</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stats.saves.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            {averages.savesRate} save rate
          </p>
        </div>

        {/* Total Comments */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Comments</span>
          </div>
          <p className="text-xs text-slate-500 font-semibold">Comments / Feedbacks</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stats.comments.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-2">
            In total of <span className="font-semibold text-slate-600">{stats.total}</span> verified crawled shots
          </p>
        </div>
      </section>

      {/* Best Performing Spotlights */}
      {(topShots.views || topShots.likes || topShots.saves || topShots.comments) && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {renderSpotlight(topShots.views, 'Most Viewed', 'Highest Reach', 'text-blue-600 bg-blue-50')}
          {renderSpotlight(topShots.likes, 'Most Liked', 'Highest Engagement', 'text-pink-600 bg-pink-50')}
          {renderSpotlight(topShots.saves, 'Most Saved', 'Highest Retention', 'text-purple-600 bg-purple-50')}
          {renderSpotlight(topShots.comments, 'Most Commented', 'Highest Discussion', 'text-emerald-600 bg-emerald-50')}
        </section>
      )}

      {/* Interactive Table Section */}
      <section className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            
            {/* Table Filter Controls */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/40 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Creative Items ({filteredShots.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">Search, filter, or click any row to inspect historical metrics timeline</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Export to CSV button */}
                  {filteredShots.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 text-xs font-semibold border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                      title="Export current table data to Excel CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export to CSV
                    </button>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search shots or tags..." 
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-9 pr-4 py-2 w-full sm:w-64 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 transition-all text-slate-700"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tag filter selector */}
                  {allTags.length > 0 && (
                    <div className="relative flex items-center">
                      <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <select
                        value={selectedTag || ''}
                        onChange={(e) => { setSelectedTag(e.target.value || null); setCurrentPage(1); }}
                        className="pl-8 pr-8 py-2 w-full sm:w-48 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 appearance-none transition-all text-slate-700 font-semibold cursor-pointer"
                      >
                        <option value="">All Tags / Niches</option>
                        {allTags.map(tag => (
                          <option key={tag} value={tag}>#{tag}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                    </div>
                  )}

                  {/* Clear filters button */}
                  {(searchQuery || selectedTag || sortBy !== 'likes' || sortOrder !== 'desc') && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-xs font-semibold border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* The Data Table */}
            <div className="overflow-x-auto">
              {paginatedShots.length > 0 ? (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold text-[11px] uppercase tracking-wider select-none">
                    <tr>
                      <th className="px-6 py-4 w-[100px]">Thumbnail</th>
                      <th className="px-6 py-4 min-w-[280px]">Shot Details</th>
                      <th 
                        onClick={() => handleSort('posted')}
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[130px]"
                      >
                        <div className="flex items-center gap-1 font-mono">
                          Posted Date
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('views')}
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 font-mono">
                          Views
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('likes')}
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 text-pink-600 font-mono">
                          Likes
                          <ArrowUpDown className="w-3.5 h-3.5 text-pink-400 group-hover:text-pink-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('saves')}
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 text-purple-600 font-mono">
                          Saves
                          <ArrowUpDown className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('comments')}
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[115px]"
                      >
                        <div className="flex items-center justify-end gap-1 font-mono">
                          Comments
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center w-[80px]">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedShots.map((shot, i) => {
                      const isExpanded = expandedShotUrl === shot.url;
                      const itemEngagement = shot.views ? ((shot.likes || 0) / shot.views * 100).toFixed(2) + '%' : '0%';
                      
                      return (
                        <React.Fragment key={i}>
                          <tr 
                            onClick={() => setExpandedShotUrl(isExpanded ? null : shot.url)}
                            className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-pink-50/10' : ''}`}
                          >
                            {/* Thumbnail Column */}
                            <td className="px-6 py-4">
                              <div className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200/60 overflow-hidden shadow-sm aspect-[4/3] relative group">
                                {shot.imageUrl ? (
                                  <img 
                                    src={shot.imageUrl} 
                                    alt={getShotTitle(shot)}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">
                                    No preview
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Title & Tags Column */}
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800 hover:text-pink-500 transition-colors leading-snug line-clamp-2">
                                    {getShotTitle(shot)}
                                  </span>
                                  {shot.history && shot.history.length > 1 && (
                                    <span className="text-[9px] text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 whitespace-nowrap font-mono">
                                      <TrendingUp className="w-2.5 h-2.5" />
                                      Tracked
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {shot.tags && Array.from(new Set(shot.tags)).slice(0, 4).map((tag, idx) => (
                                    <span 
                                      key={`${tag}-${idx}`}
                                      onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); setCurrentPage(1); }}
                                      className="text-[10px] bg-slate-100 border border-slate-200/50 text-slate-500 hover:text-pink-500 hover:border-pink-200 px-1.5 py-0.5 rounded cursor-pointer transition-all"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {shot.tags && shot.tags.length > 4 && (
                                    <span className="text-[9px] text-slate-400 font-semibold font-mono">
                                      +{shot.tags.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Posted Date */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-slate-600 text-xs flex items-center gap-1.5 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {shot.posted ? (
                                  new Date(shot.posted).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </span>
                            </td>

                            {/* Views */}
                            <td className="px-6 py-4 text-right font-semibold text-slate-700 whitespace-nowrap font-mono">
                              {shot.views?.toLocaleString() || '0'}
                            </td>

                            {/* Likes */}
                            <td className="px-6 py-4 text-right font-bold text-pink-600 whitespace-nowrap font-mono">
                              {shot.likes?.toLocaleString() || '0'}
                            </td>

                            {/* Saves */}
                            <td className="px-6 py-4 text-right font-bold text-purple-600 whitespace-nowrap font-mono">
                              {shot.saves?.toLocaleString() || '0'}
                            </td>

                            {/* Comments */}
                            <td className="px-6 py-4 text-right font-semibold text-slate-700 whitespace-nowrap font-mono">
                              {shot.comments?.toLocaleString() || '0'}
                            </td>

                            {/* External Link */}
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <a 
                                  href={shot.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open original post on Dribbble"
                                  className="p-1.5 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg inline-flex items-center justify-center transition-all"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                                <span className="text-slate-300">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Section */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50/50 p-6 border-y border-slate-100">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                  {/* Left column */}
                                  <div className="lg:col-span-4 space-y-4">
                                    <div className="rounded-xl overflow-hidden aspect-[4/3] border border-slate-200 bg-slate-100 relative shadow-inner">
                                      {shot.imageUrl ? (
                                        <img 
                                          src={shot.imageUrl} 
                                          alt={getShotTitle(shot)}
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Image Still Available</div>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Metadata Summary</h4>
                                      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Engagement conversion:</span>
                                          <span className="font-bold text-slate-700">{itemEngagement}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">First logged:</span>
                                          <span className="font-semibold text-slate-700">
                                            {shot.scrapedAt ? new Date(shot.scrapedAt as any).toLocaleDateString() : new Date().toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Original Dribbble URL:</span>
                                          <a href={shot.url} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline truncate max-w-[150px]">
                                            {shot.url}
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right column */}
                                  <div className="lg:col-span-8 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="space-y-0.5">
                                          <h4 className="text-sm font-bold text-slate-800">Shot Performance Over Time</h4>
                                          <p className="text-[11px] text-slate-400">Metric trends compiled for this creative asset</p>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">Shot-Level Database Node</span>
                                      </div>

                                      <div className="h-[180px] w-full bg-white border border-slate-200/60 rounded-xl p-3 relative">
                                        {(!shot.history || shot.history.length <= 1) && (
                                          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center text-center p-4">
                                            <Info className="w-4 h-4 text-pink-500 animate-bounce mb-1" />
                                            <p className="text-[11px] text-slate-700 font-bold">Waiting for Subsequent Day Scrapes</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">Growth charts build dynamically as daily scrape loops accumulate history metrics over time.</p>
                                          </div>
                                        )}

                                        {shot.history && shot.history.length > 0 ? (
                                          <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={shot.history.map(h => ({
                                              name: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                              views: h.views,
                                              likes: h.likes,
                                              saves: h.saves,
                                              comments: h.comments,
                                              value: h[chartMetric] || 0
                                            }))}>
                                              <defs>
                                                <linearGradient id={`colorShot_${i}`} x1="0" y1="0" x2="0" y2="1">
                                                  <stop offset="5%" stopColor="#EA4C89" stopOpacity={0.2}/>
                                                  <stop offset="95%" stopColor="#EA4C89" stopOpacity={0}/>
                                                </linearGradient>
                                              </defs>
                                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                              <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                                              <Area type="monotone" dataKey="value" name={chartMetric.toUpperCase()} stroke="#EA4C89" strokeWidth={2.5} fillOpacity={1} fill={`url(#colorShot_${i})`} />
                                            </AreaChart>
                                          </ResponsiveContainer>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-slate-100">
                                      {shot.tags && Array.from(new Set(shot.tags)).map((t, idx) => (
                                        <span 
                                          key={`${t}-${idx}`}
                                          onClick={() => { setSelectedTag(t); setCurrentPage(1); }}
                                          className="text-[10px] bg-slate-200/60 text-slate-600 hover:bg-pink-50 hover:text-pink-600 border border-transparent hover:border-pink-200 rounded px-2 py-0.5 cursor-pointer transition-all"
                                        >
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <SlidersHorizontal className="w-10 h-10 text-slate-300 stroke-[1.5] mb-3" />
                  <p className="font-bold text-slate-700 text-sm">No Matching Shots Found</p>
                  <p className="text-xs text-slate-400 mt-0.5 text-center max-w-sm">No records match your search or filter requirements. Try removing or resetting filters.</p>
                  <button 
                    onClick={clearFilters}
                    className="mt-4 px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all hover:bg-slate-700"
                  >
                    Reset Filter Parameters
                  </button>
                </div>
              )}
            </div>

            {/* Table Pagination Footer */}
            {filteredShots.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-semibold text-slate-800">
                      {Math.min(currentPage * itemsPerPage, filteredShots.length)}
                    </span>{' '}
                    of <span className="font-semibold text-slate-800">{filteredShots.length}</span> shots
                  </span>
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4 font-mono">
                    <span className="text-slate-400 font-sans">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none font-semibold text-slate-700 cursor-pointer text-xs"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-slate-600 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    // Only show a subset of page buttons if there are too many pages
                    if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} className="px-1 text-slate-400 text-xs">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all font-mono ${currentPage === pageNum ? 'bg-slate-800 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-slate-600 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
    </div>
  );
}
