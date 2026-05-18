"use client";

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Github, Loader2, MessageSquare, Network, ShieldCheck, AlertCircle } from 'lucide-react';

import { useRepoStore } from '@/lib/store';

const pills = [
  { label: 'Security Audit', icon: ShieldCheck, dot: 'bg-red-500' },
  { label: 'Architecture Map', icon: Network, dot: 'bg-[#7C3AED]' },
  { label: 'AI Chat', icon: MessageSquare, dot: 'bg-sky-500' },
];

export function UrlInput() {
  const { repoUrl, isIngesting, ingestError, ingestRepo } = useRepoStore();
  const [input, setInput] = useState(repoUrl || '');

  const clearError = () => {
    if (ingestError) setInput('');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await ingestRepo(input.trim() || 'https://github.com/owner/repo');
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-4xl">
      <div className="rounded-[28px] border border-white/70 bg-white/95 p-4 shadow-[0_24px_70px_rgba(148,163,184,0.22)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <label className="flex flex-1 items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-inner shadow-slate-100 focus-within:ring-2 focus-within:ring-[#7C3AED]">
            <Github className="h-5 w-5 text-slate-400" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="https://github.com/owner/repo"
            />
          </label>

          <button
            type="submit"
            disabled={isIngesting}
            className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#7C3AED_0%,#5B21B6_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(124,58,237,0.2),0_20px_50px_rgba(124,58,237,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isIngesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isIngesting ? 'Analyzing...' : 'Analyze Repository'}
          </button>
        </div>
        {ingestError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <div>{ingestError}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          {pills.map(({ label, icon: Icon, dot }) => (
            <div key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              <Icon className="h-4 w-4 text-slate-500" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
