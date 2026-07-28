import React, { useMemo, useState } from 'react';
import { Shot, Profile } from '../types.ts';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AnalysisTab } from './AnalysisTab.tsx';
import { PromotionsPage } from './PromotionsPage.tsx';
import { CollectionsPage } from './CollectionsPage.tsx';
import { HistoryTab } from './HistoryTab.tsx';
import { InfoTip } from './InfoTip.tsx';
import { ShotPicker } from './ShotPicker.tsx';
import { C, compact, tooltipStyle, tooltipLabelStyle } from '../chartTheme.ts';
import { INPUT_WITH_ICON, SELECT_WITH_ICON, BTN_GHOST } from '../formStyles.ts';
import { 
  Eye, 
  Heart, 
  Bookmark, 
  MessageCircle, 
  RefreshCw, 
  Search, 
  ArrowUpDown, 
  ExternalLink, 
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
} from 'lucide-react';

export function DashboardStats({ 
  shots, 
  activeProfile, 
  activeTab,
  onNavigate,
  profileManager
}: { 
  shots: Shot[]; 
  activeProfile: Profile | null; 
  activeTab: 'dashboard' | 'analysis' | 'history' | 'promotions' | 'collections';
  onNavigate?: (tab: 'dashboard' | 'analysis' | 'history' | 'promotions' | 'collections') => void;
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
  const [quickFindUrl, setQuickFindUrl] = useState('');
  // Chart states
  // Metric shown in the per-shot sparkline inside an expanded table row.
  const [chartMetric] = useState<'likes' | 'views' | 'saves' | 'comments'>('views');

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
                loading="lazy"
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

// Portfolio-relative helpers for the expanded shot panel
  const avgViewsPerShot = validShots.length > 0 ? stats.views / validShots.length : 0;
  const viewsRank = useMemo(() => {
    const m = new Map<string, number>();
    [...validShots].sort((a, b) => (b.views || 0) - (a.views || 0)).forEach((s, i) => m.set(s.url, i + 1));
    return m;
  }, [validShots]);


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
    return (
      <AnalysisTab
        shots={validShots}
        profile={activeProfile}
        onOpenPromotions={() => onNavigate?.('promotions')}
        onOpenCollections={() => onNavigate?.('collections')}
      />
    );
  }

  if (activeTab === 'history') {
    return <HistoryTab shots={validShots} />;
  }

  if (activeTab === 'promotions') {
    return <PromotionsPage shots={shots} />;
  }

  if (activeTab === 'collections') {
    return <CollectionsPage shots={shots} />;
  }

  // Otherwise, render default Dashboard Tab
  return (
    <div className="space-y-6">
      
      {profileManager}

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
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">Status of Last Run <InfoTip k="dashScraper" /></p>
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
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">Total Scraped Likes <InfoTip k="dashLikes" /></p>
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
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">Total Reach / Views <InfoTip k="dashViews" /></p>
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
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">Saved Assets / Buckets <InfoTip k="dashSaves" /></p>
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
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">Comments / Feedbacks <InfoTip k="dashComments" /></p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{stats.comments.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-2">
            In total of <span className="font-semibold text-slate-600">{stats.total}</span> verified crawled shots
          </p>
        </div>
      </section>

      {/* Best Performing Spotlights */}
      {(topShots.views || topShots.likes || topShots.saves || topShots.comments) && (
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5">
            Best Performing Shots <InfoTip k="dashSpotlight" />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {renderSpotlight(topShots.views, 'Most Viewed', 'Highest Reach', 'text-blue-600 bg-blue-50')}
          {renderSpotlight(topShots.likes, 'Most Liked', 'Highest Engagement', 'text-pink-600 bg-pink-50')}
          {renderSpotlight(topShots.saves, 'Most Saved', 'Highest Retention', 'text-purple-600 bg-purple-50')}
          {renderSpotlight(topShots.comments, 'Most Commented', 'Highest Discussion', 'text-emerald-600 bg-emerald-50')}
          </div>
        </section>
      )}

      {/* Interactive Table Section */}
      <section className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            
            {/* Table Filter Controls */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/40 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">Creative Items ({filteredShots.length}) <InfoTip k="dashTable" /></h3>
                  <p className="text-xs text-slate-500 font-medium">Search, filter, or click any row to inspect historical metrics timeline</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Quick find — sized like the other controls so the row stays on one line */}
                  {validShots.length > 8 && (
                    <div className="w-full sm:w-60">
                      <ShotPicker
                        shots={validShots}
                        value={quickFindUrl}
                        onChange={(url) => {
                          const target = validShots.find((s) => s.url === url);
                          setQuickFindUrl(url);
                          if (target) {
                            // filter the table down to it, then open its panel
                            setSearchQuery(getShotTitle(target));
                            setSelectedTag(null);
                            setCurrentPage(1);
                            setExpandedShotUrl(url);
                          }
                        }}
                        triggerLabel="Jump to a shot…"
                      />
                    </div>
                  )}

                  {/* Export to CSV button */}
                  {filteredShots.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className={BTN_GHOST}
                      title="Downloads exactly the rows currently shown, after search and tag filtering — not the whole portfolio."
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
                      title="Matches shot titles, tags and URLs."
                      
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className={`${INPUT_WITH_ICON} sm:w-64`}
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
                        title="Show only shots carrying this tag."
                        onChange={(e) => { setSelectedTag(e.target.value || null); setCurrentPage(1); }}
                        className={`${SELECT_WITH_ICON} sm:w-48`}
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
                      onClick={() => {
                        clearFilters();
                        setQuickFindUrl('');
                      }}
                      title="Reset search, tag filter, quick find and sorting back to defaults."
                      className={BTN_GHOST}
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
                      <th className="px-6 py-4 min-w-[280px]" title="Shot title and tags. Click any row to expand full detail and its history chart.">
                        Shot Details
                      </th>
                      <th 
                        onClick={() => handleSort('posted')}
                        title="Date the shot was published on Dribbble. Click to sort."
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[130px]"
                      >
                        <div className="flex items-center gap-1 font-mono">
                          Posted Date
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('views')}
                        title="All-time views for this shot. Click to sort."
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 font-mono">
                          Views
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('likes')}
                        title="All-time likes. Likes can decrease when a user unlikes or an account is removed. Click to sort."
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 text-pink-600 font-mono">
                          Likes
                          <ArrowUpDown className="w-3.5 h-3.5 text-pink-400 group-hover:text-pink-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('saves')}
                        title="Times this shot was saved to a Dribbble bucket — the strongest signal of intent. Click to sort."
                        className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors group select-none w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1 text-purple-600 font-mono">
                          Saves
                          <ArrowUpDown className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-600" />
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('comments')}
                        title="Comments received — the rarest and most effortful form of engagement. Click to sort."
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

                      // Per-shot insights for the expanded panel (work even with a single history point)
                      const shotHist = (Array.isArray(shot.history) ? shot.history : []).filter((h: any) => h && h.date);
                      const postedDate = shot.posted ? new Date(shot.posted) : null;
                      const daysSincePosted = postedDate && !isNaN(postedDate.getTime())
                        ? Math.max(1, Math.round((Date.now() - postedDate.getTime()) / 86400000))
                        : null;
                      const viewsPerDay = daysSincePosted ? Math.round((shot.views || 0) / daysSincePosted) : null;
                      const shotRank = viewsRank.get(shot.url) || null;
                      const vsAvg = avgViewsPerShot > 0 ? (shot.views || 0) / avgViewsPerShot : null;
                      const fullEngagement = shot.views
                        ? (((shot.likes || 0) + (shot.saves || 0) + (shot.comments || 0)) / shot.views * 100).toFixed(2)
                        : '0.00';
                      const lastGain = shotHist.length >= 2
                        ? Math.max(0, (shotHist[shotHist.length - 1].views || 0) - (shotHist[shotHist.length - 2].views || 0))
                        : null;

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
                                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                        Metadata Summary <InfoTip k="dashMetadata" />
                                      </h4>
                                      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2 text-xs">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400" title="Likes divided by views — how often a viewer liked what they saw.">
                                            Engagement conversion:
                                          </span>
                                          <span className="font-bold text-slate-700">{itemEngagement}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400" title="When this shot was first recorded by the scraper — not its publish date.">
                                            First logged:
                                          </span>
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
                                          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                            Shot Performance Over Time <InfoTip k="dashShotHistory" />
                                          </h4>
                                          <p className="text-[11px] text-slate-400">Metric trends compiled for this creative asset</p>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">Shot-Level Database Node</span>
                                      </div>

                                      {/* Insight chips — meaningful even from the first sync */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                        <div className="bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">Views / Day <InfoTip k="dashViewsPerDay" /></p>
                                          <p className="text-sm font-black text-slate-800 font-mono">{viewsPerDay !== null ? viewsPerDay.toLocaleString() : '—'}</p>
                                          <p className="text-[9px] text-slate-400 font-medium">{daysSincePosted ? `live for ${daysSincePosted}d` : 'no publish date'}</p>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">Portfolio Rank <InfoTip k="dashRank" /></p>
                                          <p className="text-sm font-black text-slate-800 font-mono">{shotRank ? `#${shotRank}` : '—'}<span className="text-[10px] text-slate-400 font-semibold"> / {validShots.length}</span></p>
                                          <p className={`text-[9px] font-bold ${vsAvg !== null && vsAvg >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>{vsAvg !== null ? `${vsAvg.toFixed(1)}× portfolio avg` : ''}</p>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">Engagement <InfoTip k="dashEngagement" /></p>
                                          <p className="text-sm font-black text-slate-800 font-mono">{fullEngagement}%</p>
                                          <p className="text-[9px] text-slate-400 font-medium">likes+saves+comments / views</p>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">Last Sync Gain <InfoTip k="dashLastGain" /></p>
                                          <p className={`text-sm font-black font-mono ${lastGain !== null ? 'text-emerald-600' : 'text-slate-400'}`}>{lastGain !== null ? `+${lastGain.toLocaleString()}` : '—'}</p>
                                          <p className="text-[9px] text-slate-400 font-medium">{lastGain !== null ? 'views vs previous day' : 'needs 2+ logged days'}</p>
                                        </div>
                                      </div>

                                      <div className="h-[180px] w-full bg-white border border-slate-200/60 rounded-xl p-3 relative">
                                        {shotHist.length >= 2 ? (
                                          <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={shotHist.map(h => ({
                                              name: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                              views: h.views,
                                              likes: h.likes,
                                              saves: h.saves,
                                              comments: h.comments,
                                              value: h[chartMetric] || 0
                                            }))}>
                                              <defs>
                                                <linearGradient id={`colorShot_${i}`} x1="0" y1="0" x2="0" y2="1">
                                                  <stop offset="5%" stopColor={C.likes} stopOpacity={0.25}/>
                                                  <stop offset="95%" stopColor={C.likes} stopOpacity={0}/>
                                                </linearGradient>
                                              </defs>
                                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
                                              <XAxis dataKey="name" axisLine={{ stroke: C.axis }} tickLine={false} tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }} interval="preserveStartEnd" minTickGap={20} />
                                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.muted, fontWeight: 600 }} tickFormatter={compact} />
                                              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]} />
                                              <Area type="monotone" dataKey="value" name={chartMetric.toUpperCase()} stroke={C.likes} strokeWidth={2.5} dot={{ r: 3, fill: C.likes }} fillOpacity={1} fill={`url(#colorShot_${i})`} />
                                            </AreaChart>
                                          </ResponsiveContainer>
                                        ) : (
                                          <div className="h-full flex flex-col items-center justify-center text-center gap-1.5">
                                            <div className="flex items-baseline gap-2">
                                              <span className="text-2xl font-black text-slate-800 font-mono">{(shot[chartMetric] || 0).toLocaleString()}</span>
                                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{chartMetric} today</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium max-w-xs">
                                              Trend line starts with the next daily sync
                                              {shotHist.length === 1 ? ` — first point logged ${new Date(shotHist[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.
                                            </p>
                                          </div>
                                        )}
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
