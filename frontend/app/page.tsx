"use client";

import { GitBranch, Sparkles } from 'lucide-react';

import { UrlInput } from '@/components/UrlInput';

export default function Home() {
  return (
    <section className="flex min-h-screen items-center justify-center px-6 py-12 md:px-10">
      <div className="w-full max-w-5xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#E4D9FF] bg-white px-4 py-2 text-sm font-medium text-[#5B21B6] shadow-[0_18px_40px_rgba(124,58,237,0.08)]">
          <Sparkles className="h-4 w-4" />
          AI Repository Intelligence Platform
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-[#111827]">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#1E1633] text-[#A78BFA] shadow-[0_18px_40px_rgba(31,17,71,0.22)]">
            <GitBranch className="h-6 w-6" />
          </div>
          <span className="text-3xl font-semibold tracking-tight">RepoMind</span>
        </div>

        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
          Turn any GitHub repository into an engineering ecosystem
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-500 md:text-lg">
          Inspect security, architecture, DevOps, and collaboration signals in one polished workspace. Paste a repository URL to begin.
        </p>

        <div className="mt-10 flex justify-center">
          <UrlInput />
        </div>
      </div>
    </section>
  );
}
