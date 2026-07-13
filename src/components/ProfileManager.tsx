import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Shield, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Info, 
  Database,
  Code,
  Trash2
} from 'lucide-react';
import { Profile } from '../types.ts';
import {
  apiFetchLogs,
  apiTriggerScrape,
  IS_STATIC,
  GITHUB_REPO,
  WORKFLOW_FILE,
  getSavedGithubToken,
  saveGithubToken,
  apiDispatchGithubWorkflow,
  apiLatestWorkflowRun,
} from '../api.ts';

export function ProfileManager({ 
  onProfileSelect, 
  activeUrl,
  profile,
  onProfileUpdate,
  fetchProfile
}: { 
  onProfileSelect: (url: string | null) => void;
  activeUrl: string | null;
  profile: Profile | null;
  onProfileUpdate: (p: Profile | null) => void;
  fetchProfile: (sync?: boolean) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const targetUrl = 'https://dribbble.com/helistudio';

  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // --- Manual sync via GitHub Actions (static/GitHub Pages mode) ---
  const [ghState, setGhState] = useState<'idle' | 'need_token' | 'dispatching' | 'running' | 'done' | 'error'>('idle');
  const [ghMessage, setGhMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const pollRef = useRef<any>(null);

  const dispatchWithToken = async (token: string) => {
    setGhState('dispatching');
    setGhMessage(null);
    try {
      await apiDispatchGithubWorkflow(token);
      setGhState('running');
      setGhMessage('Workflow triggered on GitHub Actions. Scrape + redeploy takes ~5–10 minutes.');

      if (pollRef.current) clearInterval(pollRef.current);
      let ticks = 0;
      pollRef.current = setInterval(async () => {
        ticks++;
        const run = await apiLatestWorkflowRun();
        if (run) {
          if (run.status === 'completed') {
            clearInterval(pollRef.current);
            if (run.conclusion === 'success') {
              setGhState('done');
              setGhMessage('Sync completed successfully — refresh this page to load the fresh data.');
            } else {
              setGhState('error');
              setGhMessage(`Workflow finished with conclusion: ${run.conclusion}. Check the Actions tab for details.`);
            }
          } else {
            setGhMessage(`Workflow ${run.status.replace('_', ' ')}… (~5–10 min total). Re-runs on the same day replace that day's record.`);
          }
        }
        if (ticks > 45) clearInterval(pollRef.current); // stop after ~15 min
      }, 20000);
    } catch (e: any) {
      setGhState('error');
      setGhMessage(e?.message || 'Failed to trigger the workflow.');
      if (/401|403|rejected/i.test(String(e?.message))) saveGithubToken('');
    }
  };

  const handleGithubDispatch = async () => {
    const token = getSavedGithubToken();
    if (!token) {
      setGhState('need_token');
      return;
    }
    await dispatchWithToken(token);
  };

  const handleSaveTokenAndRun = async () => {
    const t = tokenInput.trim();
    if (!t) return;
    saveGithubToken(t);
    setTokenInput('');
    await dispatchWithToken(t);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleScrape = async () => {
    setLoading(true);
    setScrapeError(null);
    try {
      if (profile) {
        onProfileUpdate({ ...profile, status: 'scraping', progressMessage: 'Initiating secure agent...' });
      }
      setLogs([]); // Reset local logs instantly
      await apiTriggerScrape(targetUrl);
      await fetchProfile(true);
    } catch (e: any) {
      console.error('Failed to trigger scrape', e);
      setScrapeError(e.message || 'Failed to trigger scrape');
      // Revert the optimistic "scraping" status with the real server state
      await fetchProfile(true);
    } finally {
      setLoading(false);
    }
  };

  // Poll logs for the profile
  useEffect(() => {
    if (!profile?.id) return;

    let intervalId: any;
    
    const loadLogs = async () => {
      try {
        const data = await apiFetchLogs(profile.id);
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs', err);
      }
    };

    loadLogs();

    if (profile.status === 'scraping') {
      intervalId = setInterval(loadLogs, 1500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [profile?.id, profile?.status]);

  // Auto-scroll effect (only scroll the log console container internally, avoiding window scrolling)
  useEffect(() => {
    if (showLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs.length, showLogs]);

  const getStatusBadge = () => {
    if (!profile) return null;
    switch (profile.status) {
      case 'scraping':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase animate-pulse border border-blue-100">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Syncing Live Data
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sync Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border border-red-100">
            <AlertCircle className="w-3.5 h-3.5" />
            Sync Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Sync
          </span>
        );
    }
  };

  const getLastScrapedTime = () => {
    if (!profile?.lastScrapedAt) return 'Never synced';
    const t = profile.lastScrapedAt as any;
    let seconds = 0;
    
    if (typeof t === 'object' && t !== null) {
      if (t._seconds !== undefined) {
        seconds = t._seconds;
      } else if (t.seconds !== undefined) {
        seconds = t.seconds;
      } else if (typeof t.toDate === 'function') {
        try {
          return t.toDate().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {}
      }
    } else {
      const d = new Date(t);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    if (seconds > 0) {
      const date = new Date(seconds * 1000);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'Never synced';
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = log.message.toLowerCase().includes(filterText.toLowerCase()) || 
                          (log.level && log.level.toLowerCase().includes(filterText.toLowerCase())) ||
                          (log.details && JSON.stringify(log.details).toLowerCase().includes(filterText.toLowerCase()));
    const matchesLevel = selectedLogLevel === 'all' || log.level === selectedLogLevel;
    return matchesFilter && matchesLevel;
  });

  const getLogBadgeStyle = (level: string) => {
    switch (level) {
      case 'success':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40';
      case 'error':
        return 'bg-red-950/40 text-red-400 border border-red-900/40';
      case 'warn':
        return 'bg-amber-950/40 text-amber-400 border border-amber-900/40';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const formatLogTime = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* ===== Header row: identity + actions ===== */}
      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-pink-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="text-lg font-extrabold text-slate-800 tracking-tight">Heli Studio Enterprise Node</h4>
              {getStatusBadge()}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Dribbble performance tracker · {IS_STATIC ? 'auto-syncs daily via GitHub Actions' : 'local server mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              showLogs
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
            {logs.length > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] font-mono ${showLogs ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                {logs.length}
              </span>
            )}
          </button>

          {IS_STATIC ? (
            <>
              <a
                href={GITHUB_REPO ? `https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                title="Open GitHub Actions"
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Actions
              </a>
              <button
                onClick={handleGithubDispatch}
                disabled={ghState === 'dispatching' || ghState === 'running'}
                className="flex items-center justify-center gap-2 pink-gradient text-white font-bold py-2.5 px-5 rounded-xl text-xs hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-pink-200/50"
              >
                <RefreshCw className={`w-4 h-4 ${ghState === 'dispatching' || ghState === 'running' ? 'animate-spin' : ''}`} />
                {ghState === 'running' ? 'Sync Running…' : 'Trigger Manual Sync'}
              </button>
            </>
          ) : (
            <button
              onClick={handleScrape}
              disabled={loading || profile?.status === 'scraping'}
              className="flex items-center justify-center gap-2 pink-gradient text-white font-bold py-2.5 px-5 rounded-xl text-xs hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-pink-200/50"
            >
              <RefreshCw className={`w-4 h-4 ${profile?.status === 'scraping' ? 'animate-spin' : ''}`} />
              {profile?.status === 'scraping' ? 'Syncing Network…' : 'Trigger Manual Sync'}
            </button>
          )}
        </div>
      </div>

      {/* ===== Meta strip / live progress ===== */}
      {profile?.status === 'scraping' ? (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-4">
          <div className="flex-1 bg-slate-200/70 h-2 rounded-full overflow-hidden relative">
            {profile.scrapedCount !== undefined && profile.totalCount !== undefined && profile.totalCount > 0 ? (
              <div
                className="bg-pink-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(profile.scrapedCount / profile.totalCount) * 100}%` }}
              />
            ) : (
              <div className="bg-pink-500 h-full rounded-full w-1/3 animate-infinite-scroll" />
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-mono font-semibold whitespace-nowrap max-w-[50%] truncate">
            {profile.totalCount ? `${profile.scrapedCount || 0}/${profile.totalCount} · ` : ''}{profile.progressMessage || 'Contacting scraper...'}
          </span>
        </div>
      ) : (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-semibold text-slate-500">
          <a href={targetUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-pink-500 transition-colors">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            {targetUrl.replace('https://', '')}
          </a>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Last sync: <strong className="font-mono text-slate-700">{getLastScrapedTime()}</strong>
          </span>
          {profile?.lastRunStats && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <strong className="font-mono text-slate-700">{profile.lastRunStats.successCount}/{profile.lastRunStats.total}</strong> shots synced
            </span>
          )}
          {IS_STATIC && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Info className="w-3.5 h-3.5" />
              Same-day re-runs replace that day&rsquo;s record
            </span>
          )}
        </div>
      )}

      {scrapeError && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            Manual sync failed: {scrapeError}
          </p>
        </div>
      )}

      {IS_STATIC && ghState === 'need_token' && (
        <div className="px-5 pb-4 -mt-1">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-700">One-time setup: paste a GitHub token to enable this button</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="text-pink-600 font-semibold underline">fine-grained token</a> with
              access to <span className="font-mono font-semibold">{GITHUB_REPO || 'this repository'}</span> and permission <span className="font-semibold">Actions: Read and write</span>.
              It is stored only in this browser (localStorage) and sent only to api.github.com.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="github_pat_..."
                className="flex-1 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
              <button
                onClick={handleSaveTokenAndRun}
                disabled={!tokenInput.trim()}
                className="pink-gradient text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Save & Run
              </button>
              <button
                onClick={() => { setGhState('idle'); setTokenInput(''); }}
                className="text-xs font-bold text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {IS_STATIC && ghMessage && ghState !== 'need_token' && (
        <div className="px-5 pb-4 -mt-1">
          <p className={`text-xs font-semibold rounded-lg px-3 py-2 border ${
            ghState === 'error' ? 'text-red-600 bg-red-50 border-red-100'
            : ghState === 'done' ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
            : 'text-sky-700 bg-sky-50 border-sky-100'
          }`}>
            {ghMessage}
            {ghState === 'error' && GITHUB_REPO && (
              <>
                {' '}
                <a className="underline font-bold" href={`https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`} target="_blank" rel="noopener noreferrer">Open Actions</a>
              </>
            )}
          </p>
        </div>
      )}

      {/* DETAILED DIAGNOSTIC LOG CONSOLE */}
      {showLogs && (
        <div className="border-t border-slate-100 bg-slate-950/95 text-slate-100 transition-all">
          <div className="px-5 py-3 border-b border-slate-900 bg-slate-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-bold tracking-wider text-[11px] text-slate-400 font-mono">
              <Terminal className="w-4 h-4 text-pink-500 animate-pulse" />
              DIAGNOSTIC PROCESS TRACE
            </div>
            
            {/* Search and level filter buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  const logText = filteredLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
                  navigator.clipboard.writeText(logText);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 hover:text-white transition-all text-xs font-semibold mr-2"
                title="Copy all filtered logs to clipboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Logs
              </button>
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter outputs..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-slate-900 text-slate-200 pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-slate-700 w-full sm:w-44 text-[11px] font-mono"
                />
              </div>

              <div className="flex gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(['all', 'info', 'success', 'warn', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLogLevel(lvl)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all font-mono ${
                      selectedLogLevel === lvl 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={logsContainerRef} className="p-4 max-h-72 min-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {filteredLogs.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Database className="w-6 h-6 text-slate-600 animate-bounce" />
                <p className="text-[11px]">No diagnostic logs matches current filters.</p>
                {logs.length === 0 && (
                  <p className="text-[10px] text-slate-600">Trigger a manual sync to monitor execution telemetry in real-time.</p>
                )}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;
                
                return (
                  <div 
                    key={log.id} 
                    className={`group border rounded-lg p-2.5 transition-all ${
                      log.level === 'error' 
                        ? 'bg-red-950/10 border-red-900/20' 
                        : log.level === 'warn' 
                        ? 'bg-amber-950/10 border-amber-900/20'
                        : log.level === 'success'
                        ? 'bg-emerald-950/10 border-emerald-900/20'
                        : 'bg-slate-900/30 border-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Time stamp */}
                        <span className="text-[10px] text-slate-600 font-semibold select-none flex-shrink-0 pt-0.5">
                          {formatLogTime(log.timestamp)}
                        </span>
                        
                        {/* Level badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase select-none flex-shrink-0 ${getLogBadgeStyle(log.level)}`}>
                          {log.level}
                        </span>

                        {/* Log message */}
                        <span className={`leading-relaxed break-all ${
                          log.level === 'error' 
                            ? 'text-red-400 font-semibold' 
                            : log.level === 'warn' 
                            ? 'text-amber-400 font-semibold'
                            : log.level === 'success'
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>

                      {hasDetails && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all rounded text-[9px] font-bold"
                        >
                          <Code className="w-2.5 h-2.5" />
                          {isExpanded ? 'Hide info' : 'Inspect'}
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        </button>
                      )}
                    </div>

                    {/* Expandable JSON/details trace */}
                    {isExpanded && hasDetails && (
                      <div className="mt-2 p-2 bg-slate-950 border border-slate-900 rounded-md text-[10px] text-slate-400 overflow-x-auto font-mono scrollbar-thin">
                        <pre className="whitespace-pre-wrap select-all leading-normal text-slate-300">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div />
          </div>
          
          <div className="px-5 py-2 border-t border-slate-900 bg-slate-900/10 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Trace status: <strong className="text-slate-400 uppercase">{profile?.status || 'idle'}</strong></span>
            {profile?.status === 'scraping' && (
              <span className="flex items-center gap-1 text-pink-500">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                STREAMING RUNTIME
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
