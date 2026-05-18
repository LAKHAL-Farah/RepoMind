"use client";

import { Bell, DatabaseZap, Palette, Settings } from 'lucide-react';

import { StatCard } from '@/components/StatCard';
import { useRepoStore } from '@/lib/store';

export default function SettingsPage() {
  const { summary, repoUrl } = useRepoStore();

  return (
    <div className="page-enter px-6 py-6 md:px-8">
      <header>
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-[#7C3AED]" />
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">Workspace preferences for the currently loaded repository context.</p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DatabaseZap} label="Indexed Repo" value={summary ? '1' : '0'} accentClass="text-[#7C3AED]" />
        <StatCard icon={Bell} label="Alerts Enabled" value="On" accentClass="text-blue-500" />
        <StatCard icon={Palette} label="Theme" value="Cloud Dock" accentClass="text-emerald-500" />
        <StatCard icon={Settings} label="Mode" value="Team" accentClass="text-slate-500" />
      </section>

      <section className="mt-8 rounded-[24px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
        <h2 className="text-xl font-semibold text-slate-900">Workspace controls</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[20px] bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Repository source</p>
            <p className="mt-1 text-sm text-slate-500">{repoUrl || 'No repository selected yet.'}</p>
          </div>
          <div className="rounded-[20px] bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Retention</p>
            <p className="mt-1 text-sm text-slate-500">Cached analysis data is kept for rapid revisit in this demo workspace.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
