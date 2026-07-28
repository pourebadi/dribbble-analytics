import React, { useEffect, useState } from 'react';
import { KeyRound, Check, ExternalLink, Loader2, ShieldCheck, LogOut, AlertTriangle } from 'lucide-react';
import { IS_STATIC, GITHUB_REPO } from '../api.ts';
import {
  connect,
  disconnect,
  getMeta,
  isConnected,
  subscribeConnection,
  daysUntilExpiry,
  NEW_TOKEN_URL,
} from '../githubConnection.ts';

/**
 * Connection state for static deployments.
 *
 * Before connecting this is the setup form itself — the token field is right
 * here rather than appearing later after a save has already failed. Once
 * connected it collapses to a single quiet line showing who is connected, and
 * only speaks up again if the token is close to expiring.
 */
export function StaticModeNotice({ file }: { file: string }) {
  const [, force] = useState(0);
  useEffect(() => subscribeConnection(() => force((n) => n + 1)), []);

  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!IS_STATIC) return null;

  // ---------- connected ----------
  if (isConnected()) {
    const meta = getMeta();
    const days = daysUntilExpiry();
    const expiringSoon = days !== null && days <= 14;

    return (
      <div
        className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${
          expiringSoon ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50/60 border-emerald-100'
        }`}
      >
        {expiringSoon ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        )}
        <p className={`text-[11px] font-bold ${expiringSoon ? 'text-amber-900' : 'text-emerald-800'}`}>
          Connected to GitHub as {meta?.login || 'your account'} — changes save straight to the repository.
        </p>
        {days !== null && (
          <span
            className={`text-[10px] font-mono font-bold ${expiringSoon ? 'text-amber-700' : 'text-emerald-600/70'}`}
          >
            {days > 0 ? `token expires in ${days} day${days === 1 ? '' : 's'}` : 'token has expired'}
          </span>
        )}
        <button
          onClick={disconnect}
          className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
          title="Forget the token stored in this browser"
        >
          <LogOut className="w-3 h-3" />
          Disconnect
        </button>
      </div>
    );
  }

  // ---------- not connected ----------
  const doConnect = async () => {
    setBusy(true);
    setError(null);
    const res = await connect(token);
    setBusy(false);
    if (!res.ok) setError(res.message);
    else setToken('');
  };

  return (
    <div className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2.5">
        <span className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
          <KeyRound className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-amber-900">Connect GitHub once to save your work</p>
          <p className="text-[11px] text-amber-700 font-medium">
            This dashboard runs without a server, so it writes <code className="font-mono">{file}</code> straight to
            your repository. Connect once — you will not be asked again.
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-wrap items-center gap-2.5">
        <a
          href={NEW_TOKEN_URL}
          target="_blank"
          rel="noreferrer"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:text-amber-700 transition-all whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Create a token
        </a>

        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doConnect()}
          placeholder="Paste it here — github_pat_…"
          className="h-9 flex-1 min-w-[220px] px-3 text-xs font-mono bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
        />

        <button
          onClick={doConnect}
          disabled={!token.trim() || busy}
          className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 transition-all whitespace-nowrap"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {busy ? 'Checking…' : 'Connect'}
        </button>

        <div className="w-full text-[10px] text-slate-400 font-semibold leading-relaxed">
          On the GitHub page: <span className="font-bold text-slate-500">Repository access → Only select
          repositories → {GITHUB_REPO || 'this repo'}</span>, then{' '}
          <span className="font-bold text-slate-500">Repository permissions → Contents → Read and write</span>. Give
          it an expiry date. The token can touch nothing but this repository, is stored only in this browser, is sent
          only to GitHub, and is never committed. Self-hosting the dashboard removes the need for it entirely.
        </div>

        {error && (
          <p className="w-full text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
