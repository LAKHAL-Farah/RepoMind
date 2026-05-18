"use client";

import { Sparkles } from 'lucide-react';

import { UrlInput } from '@/components/UrlInput';

export default function NewRepoPage() {
  return (
    <div className="page-enter flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#7C3AED] shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
          <Sparkles className="h-4 w-4" />
          Launch a new analysis
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Analyze a repository in a single step</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-500">Paste a GitHub URL and RepoMind will ingest, inspect, and route you into the full workspace.</p>
        <div className="mt-10 flex justify-center">
          <UrlInput />
        </div>
      </div>
    </div>
  );
}
