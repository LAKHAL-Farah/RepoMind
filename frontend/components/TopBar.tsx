"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, GitBranch, Plus, X } from 'lucide-react';

import { api } from '@/lib/api';
import { useRepoStore } from '@/lib/store';

function buildBreadcrumb(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'Dashboard';
  const labels = ['Dashboard', ...parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1))];
  if (parts[0] === 'security') labels.push('Findings');
  if (parts[0] === 'architecture') labels.push('Services');
  return labels.join(' / ');
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { repoId, summary, repoUrl, reset } = useRepoStore();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await api.getHealth();
        if (mounted) setHealthy(true);
      } catch {
        if (mounted) setHealthy(false);
      }
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!repoId && pathname !== '/') {
      setToast('Please analyze a repository first');
    }
  }, [repoId, pathname]);

  const breadcrumb = useMemo(() => buildBreadcrumb(pathname), [pathname]);

  const copyRepoUrl = async () => {
    if (!repoUrl) return;
    await navigator.clipboard.writeText(repoUrl);
    setToast('Repository URL copied');
  };

  return (
    <>
      <div className="fixed left-0 top-0 z-[100] flex h-12 w-full items-center border-b border-slate-200 bg-white/95 px-4 pl-[72px] backdrop-blur-md">
        <div className="flex w-full items-center gap-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{breadcrumb}</div>
          <button type="button" onClick={copyRepoUrl} className="inline-flex max-w-[300px] items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{summary?.name ?? 'No repo loaded'}</span>
          </button>
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${healthy ? 'bg-emerald-500' : healthy === false ? 'bg-red-500' : 'bg-slate-300'}`} />
            <span>{healthy ? 'Healthy' : healthy === false ? 'Offline' : 'Checking'}</span>
          </div>
          <button type="button" onClick={() => { reset(); router.push('/'); }} className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
            <Plus className="h-3.5 w-3.5" />
            Ingest New Repo
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.15)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-500" />
            <div className="flex-1 text-sm text-slate-700">{toast}</div>
            <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close toast">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
