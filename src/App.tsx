/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProfileManager } from './components/ProfileManager.tsx';
import { DashboardStats } from './components/DashboardStats.tsx';
import { Shot, Profile } from './types.ts';
import { apiFetchProfiles, apiFetchShots, IS_STATIC } from './api.ts';
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
          localStorage.setItem(`cached_profile_${targetUrl}`, JSON.stringify(found));
          if (activeProfileUrl !== found.url) {
            setActiveProfileUrl(found.url);
          }
        }
      }
    } catch (e) {
      console.log('Failed to fetch profile status (expected if server reloading)', e);
      try {
        const cached = localStorage.getItem(`cached_profile_${targetUrl}`);
        if (cached) {
          setProfile(JSON.parse(cached));
        }
      } catch (_) {}
    }
  };

  const fetchShots = async (profileUrl: string | null, sync: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchShots(profileUrl);

      if (Array.isArray(data)) {
        setShots(data);
        localStorage.setItem(`cached_shots_${profileUrl || 'all'}`, JSON.stringify(data));
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (e: any) {
      console.log('Failed to fetch shots (expected if server reloading)', e);
      setError(e.message || 'Failed to fetch shots');
      try {
        const cached = localStorage.getItem(`cached_shots_${profileUrl || 'all'}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setShots(parsed);
          }
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = () => {
    fetchProfile(true);
    fetchShots(activeProfileUrl, true);
  };

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden font-sans">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 pink-gradient rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.172-1.172a4 4 0 115.656 5.656L10 17.657"/>
            </svg>
          </div>
          <span className="font-bold text-lg text-slate-800 tracking-tight">Heli Analytics</span>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
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
            onClick={() => setActiveTab('history')}
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
            onClick={() => setActiveTab('analysis')}
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
        
        <div className="p-6 border-t border-slate-100 space-y-3.5 bg-slate-50/50">
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Integration</p>
            <div className="flex items-center text-xs text-slate-600 font-semibold gap-2">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>{IS_STATIC ? 'Static Mode (GitHub Pages)' : 'Daily Sync (GitHub Actions)'}</span>
            </div>
            <div className="flex items-center text-xs text-slate-600 font-semibold gap-2">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>{IS_STATIC ? 'Data from repo snapshots' : 'Local SQLite DB'}</span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono font-semibold">
            <span>ENV: SELF-HOSTED</span>
            <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
              <ShieldCheck className="w-3 h-3" />
              SSL
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? 'Heli Studio Performance' : activeTab === 'history' ? 'Historical Ledger' : 'Growth Analysis & Management Dashboard'}
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              {activeTab === 'dashboard' 
                ? 'Dribbble Portfolio Insights & Growth Analytics Node' 
                : activeTab === 'history' 
                ? 'Historical daily record aggregates and account activity tracking'
                : 'Advanced trend lines, tracking for management and social team overview'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-400 font-semibold font-mono bg-slate-100 px-3 py-1 rounded-lg">
              UTC: {new Date().toISOString().split('T')[0]}
            </span>
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
          onSync={handleManualSync} 
          isSyncing={loading} 
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

