/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProfileManager } from './components/ProfileManager.tsx';
import { DashboardStats } from './components/DashboardStats.tsx';
import { Shot, Profile } from './types.ts';
import { apiFetchProfiles, apiFetchShots, IS_STATIC, GITHUB_REPO } from './api.ts';
import { LoginGate } from './components/LoginGate.tsx';
import { ShareView } from './components/ShareView.tsx';
import { apiFetchAnnotations, Annotation } from './api.ts';
import { isAuthed, logout, AUTH_USER } from './auth.ts';
import { LogOut, Settings, ExternalLink, Timer, Menu, X, Moon, Sun } from 'lucide-react';

/**
 * Countdown to the next automatic scrape.
 * The daily workflow runs at 20:20 UTC (= 23:50 Asia/Tehran) — keep in sync
 * with .github/workflows/daily-scrape.yml.
 */
const SYNC_UTC_HOUR = 20;
const SYNC_UTC_MINUTE = 20;

function NextSyncCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const next = new Date(now);
  next.setUTCHours(SYNC_UTC_HOUR, SYNC_UTC_MINUTE, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);

  const diffMin = Math.max(0, Math.round((next.getTime() - now) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  const localTime = next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <span
      title={`Next automatic scrape at ${localTime} (your local time)`}
      className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-sm"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Timer className="w-3.5 h-3.5 text-slate-400" />
      Next auto-sync in <span className="font-mono text-pink-600">{h > 0 ? `${h}h ` : ''}{m}m</span>
    </span>
  );
}
import { LayoutDashboard, LineChart, History, Cpu, Server, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeProfileUrl, setActiveProfileUrl] = useState<string | null>('https://dribbble.com/helistudio');
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'analysis'>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetUrl = 'https://dribbble.com/helistudio';

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchShots(activeProfileUrl, false);
  }, [activeProfileUrl]);

  useEffect(() => {
    fetchProfile(false);
    // Only poll frequently if we are actively scraping
    const interval = setInterval(() => {
      if (profile?.status === 'scraping') {
         fetchProfile(true); // Force sync to get progress
      } else {
         fetchProfile(false);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [profile?.status]);

  useEffect(() => {
    if (profile?.status) {
      if (lastStatus === 'scraping' && profile.status === 'completed') {
        // Active scraping has finished! Reload shots immediately to show the fresh data
        fetchShots(activeProfileUrl, true);
      }
      setLastStatus(profile.status);
    }
  }, [profile?.status, activeProfileUrl, lastStatus]);

  const fetchProfile = async (sync: boolean = false) => {
    try {
      const data = await apiFetchProfiles();

      if (Array.isArray(data)) {
        const found = data.find((p: any) => p.url === targetUrl) || data[0];
        if (found) {
          setProfile(found);
          if (activeProfileUrl !== found.url) {
            setActiveProfileUrl(found.url);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile status', e);
    }
  };

  const fetchShots = async (profileUrl: string | null, sync: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchShots(profileUrl);

      if (Array.isArray(data)) {
        setShots(data);
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (e: any) {
      console.error('Failed to fetch shots', e);
      setError(e.message || 'Failed to fetch shots');
    } finally {
      setLoading(false);
    }
  };

  const [authed, setAuthedState] = useState(() => isAuthed());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('heli_dark') === '1'; } catch { return false; } });

  useEffect(() => {
    document.documentElement.classList.toggle('dark-invert', dark);
    try { localStorage.setItem('heli_dark', dark ? '1' : '0'); } catch { /* ignore */ }
  }, [dark]);

  useEffect(() => { apiFetchAnnotations().then(setAnnotations).catch(() => {}); }, []);

  // Public read-only share route: #/share/<chartId> (no login required)
  const shareMatch = window.location.hash.match(/^#\/share\/([a-z]+)/);
  if (shareMatch) {
    return <ShareView chartId={shareMatch[1]} />;
  }

  if (!authed) {
    return <LoginGate onSuccess={() => setAuthedState(true)} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden font-sans">
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transform transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 pink-gradient rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.172-1.172a4 4 0 115.656 5.656L10 17.657"/>
            </svg>
          </div>
          <span className="font-bold text-lg text-slate-800 tracking-tight">Heli Technology</span>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full px-4 py-3 flex items-center space-x-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${
              activeTab === 'dashboard' 
                ? 'bg-pink-50/75 text-pink-600 border-pink-100/50 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Main Dashboard</span>
          </button>

          <button 
            onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
            className={`w-full px-4 py-3 flex items-center space-x-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${
              activeTab === 'history' 
                ? 'bg-pink-50/75 text-pink-600 border-pink-100/50 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>

          <button 
            onClick={() => { setActiveTab('analysis'); setSidebarOpen(false); }}
            className={`w-full px-4 py-3 flex items-center space-x-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${
              activeTab === 'analysis' 
                ? 'bg-pink-50/75 text-pink-600 border-pink-100/50 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Growth Analysis</span>
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {/* Profile card */}
          <div className="relative">
            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/70 p-2 space-y-0.5">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-extrabold text-slate-800">Heli Studio</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Signed in as <span className="font-mono text-slate-500">{AUTH_USER}</span></p>
                  </div>
                  <a href={activeProfileUrl || 'https://dribbble.com/helistudio'} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> Dribbble profile
                  </a>
                  {GITHUB_REPO && (
                    <a href={`https://github.com/${GITHUB_REPO}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                      <Settings className="w-3.5 h-3.5 text-slate-400" /> Repository & workflows
                    </a>
                  )}
                  <button
                    onClick={() => setDark(!dark)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    {dark ? <Sun className="w-3.5 h-3.5 text-slate-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
                    {dark ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    onClick={() => { logout(); setAuthedState(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${profileMenuOpen ? 'bg-white border-pink-200 shadow-sm' : 'bg-white border-slate-200 hover:border-pink-200'}`}
            >
              <div className="w-9 h-9 pink-gradient rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm shadow-pink-200/50 flex-shrink-0">
                HS
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-extrabold text-slate-800 truncate">Heli Studio</p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">Design & Growth Team</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            </button>
          </div>

          <div className="space-y-1.5 px-1">
            <div className="flex items-center text-[11px] text-slate-500 font-semibold gap-2">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>{IS_STATIC ? 'Static Mode (GitHub Pages)' : 'Daily Sync (GitHub Actions)'}</span>
            </div>
            <div className="flex items-center text-[11px] text-slate-500 font-semibold gap-2">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>{IS_STATIC ? 'Data from repo snapshots' : 'Local SQLite DB'}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex-shrink-0">
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? 'Heli Studio Portfolio' : activeTab === 'history' ? 'Historical Ledger' : 'Growth Analysis & Management Dashboard'}
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              {activeTab === 'dashboard' 
                ? 'Dribbble Portfolio Insights & Growth Analytics Node' 
                : activeTab === 'history' 
                ? 'Historical daily record aggregates and account activity tracking'
                : 'Advanced trend lines, tracking for management and social team overview'}
            </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <NextSyncCountdown />
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 shadow-sm animate-fade-in">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-amber-900">Live data unavailable — showing cached data</h4>
              <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">
                The server could not return fresh data ({error}). The dashboard is showing the last data
                cached in this browser, so the numbers below may be outdated. Retry the sync once the server is reachable.
              </p>
            </div>
          </div>
        )}

        <DashboardStats 
          shots={shots} 
          activeProfile={profile} 
          activeTab={activeTab} 
          annotations={annotations}
          profileManager={
            <ProfileManager 
              onProfileSelect={setActiveProfileUrl} 
              activeUrl={activeProfileUrl}
              profile={profile}
              onProfileUpdate={setProfile}
              fetchProfile={fetchProfile}
            />
          }
        />
      </main>
    </div>
  );
}

