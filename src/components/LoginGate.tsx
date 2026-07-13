import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { verifyCredentials, setAuthed } from '../auth.ts';

export function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password || checking) return;
    setChecking(true);
    setError(null);
    const ok = await verifyCredentials(username, password);
    if (ok) {
      setAuthed(remember);
      onSuccess();
    } else {
      setError('Invalid username or password.');
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* decorative orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-pink-200/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-violet-200/40 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/60 p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 pink-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200/60 mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Heli Technology</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Dribbble Analytics · sign in to continue</p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Username</span>
              <div className="mt-1.5 relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="HeliStudio"
                  autoFocus
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300 focus:bg-white transition-all"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</span>
              <div className="mt-1.5 relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 accent-pink-500 rounded"
                />
                Keep me signed in
              </label>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!username || !password || checking}
              className="w-full flex items-center justify-center gap-2 pink-gradient text-white font-bold py-3 rounded-xl text-sm hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition-all shadow-lg shadow-pink-200/50"
            >
              {checking ? 'Verifying…' : 'Sign in'}
              {!checking && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 font-medium mt-4">
          Access is limited to the Heli Studio team.
        </p>
      </div>
    </div>
  );
}
