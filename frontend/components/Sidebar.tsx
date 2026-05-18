"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, Container, GitBranch, LayoutDashboard, MessageSquare, Rocket, Search, ShieldCheck } from 'lucide-react';

import { useRepoStore } from '@/lib/store';

type SectionGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  items: { label: string; href: string; meta?: string }[];
};

const emptyFindings = { security: [], devops: [], architecture: [], code_quality: [] };

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/overview': 'Overview',
  '/security': 'Security Analysis',
  '/architecture': 'Architecture Map',
  '/devops': 'DevOps Analysis',
  '/chat': 'AI Chat',
  '/new': 'Analyze Repo',
  '/settings': 'Settings',
};

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({ overview: true, security: true, architecture: true, devops: true, chat: true });
  const { repoId, findings, services, summary, messages } = useRepoStore();

  const withRepo = (href: string) => {
    if (!repoId || href === '/' || href === '/new') return href;
    const [path, hash = ''] = href.split('#');
    const resolvedPath = path.includes('?') ? `${path}&repoId=${encodeURIComponent(repoId)}` : `${path}?repoId=${encodeURIComponent(repoId)}`;
    return hash ? `${resolvedPath}#${hash}` : resolvedPath;
  };

  const findingsList = useMemo(() => findings ?? emptyFindings, [findings]);

  const securityCounts = {
    critical: (findingsList.security || []).filter((f) => f.severity === 'critical').length,
    warning: (findingsList.security || []).filter((f) => f.severity === 'warning').length,
    info: (findingsList.security || []).filter((f) => f.severity === 'info').length,
  };

  const dockerCount = summary?.docker_files?.length ?? 0;
  const ciCdCount = summary?.ci_cd_files?.length ?? 0;

  const groups = useMemo<SectionGroup[]>(() => [
    {
      label: 'My Overview',
      icon: LayoutDashboard,
      items: [
        { label: 'Recent Activity', href: '/overview', meta: `${(findingsList.security || []).length + (findingsList.architecture || []).length + (findingsList.devops || []).length + (findingsList.code_quality || []).length}` },
        { label: 'Detected Services', href: '/architecture', meta: `${services?.length ?? 0} services` },
      ],
    },
    {
      label: 'Security Findings',
      icon: ShieldCheck,
      items: [
        { label: 'Critical', href: '/security', meta: `${securityCounts.critical}` },
        { label: 'Warnings', href: '/security', meta: `${securityCounts.warning}` },
        { label: 'Info', href: '/security', meta: `${securityCounts.info}` },
      ],
    },
    {
      label: 'Detected Services',
      icon: GitBranch,
      items: (services || []).map((service) => ({ label: service.name, href: `/architecture#service-${encodeURIComponent(service.name)}`, meta: `${service.file_count} files` })),
    },
    {
      label: 'DevOps Assets',
      icon: Container,
      items: [
        { label: 'Dockerfiles', href: '/devops', meta: `${dockerCount}` },
        { label: 'Pipelines', href: '/devops', meta: `${ciCdCount}` },
      ],
    },
    {
      label: 'Chat History',
      icon: MessageSquare,
      items: (messages || []).filter(m => m.role === 'user').slice(-3).map((message) => ({ label: (message.content || '').slice(0, 30), href: '/chat', meta: message.timestamp })),
    },
  ], [findingsList, services, messages, securityCounts.critical, securityCounts.warning, securityCounts.info, dockerCount, ciCdCount]);

  const activeGroups = pathname === '/security'
    ? [groups[1]]
    : pathname === '/architecture'
      ? [groups[2]]
      : pathname === '/devops'
        ? [groups[3]]
        : pathname === '/chat'
          ? [groups[4]]
          : pathname === '/overview'
            ? [groups[0]]
            : pathname === '/new' || pathname === '/settings'
              ? [groups[0], groups[4]]
              : [groups[0]];

            if (pathname === '/security') {
              return null;
            }

  return (
    <aside className="fixed left-14 top-0 z-30 hidden h-screen w-[240px] border-r border-white/10 bg-sidebar text-white shadow-[0_0_30px_rgba(0,0,0,0.28)] md:flex md:flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">{routeTitles[pathname] ?? 'RepoMind'}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{routeTitles[pathname] ?? 'RepoMind'}</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((state) => ({ ...state, overview: !state.overview }))}
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
          aria-label="Toggle sidebar"
        >
          {open.overview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div className="px-4 py-4">
        <label className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/5 px-3 py-3 text-white/55 shadow-inner shadow-black/10">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-sm">Search</span>
          <kbd className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">Cmd+K</kbd>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {repoId ? (
          activeGroups.map((group, index) => {
            const key = group.label;
            const sectionOpen = open[key.toLowerCase().includes('overview') ? 'overview' : key.toLowerCase().includes('security') ? 'security' : key.toLowerCase().includes('service') ? 'architecture' : key.toLowerCase().includes('devops') ? 'devops' : 'chat'] ?? true;
            return (
              <section key={group.label} className="mb-3 rounded-[22px] border border-white/8 bg-white/4 p-3 backdrop-blur-sm page-enter" style={{ animationDelay: `${index * 55}ms` }}>
                <button type="button" onClick={() => setOpen((state) => ({ ...state, [key.toLowerCase().includes('overview') ? 'overview' : key.toLowerCase().includes('security') ? 'security' : key.toLowerCase().includes('service') ? 'architecture' : key.toLowerCase().includes('devops') ? 'devops' : 'chat']: !sectionOpen }))} className="flex w-full items-center justify-between rounded-2xl px-1 py-2 text-left transition hover:text-white">
                  <div className="flex items-center gap-2">
                    <group.icon className="h-4 w-4 text-[#A78BFA]" />
                    <span className="text-sm font-medium text-white">{group.label}</span>
                  </div>
                  {sectionOpen ? <ChevronDown className="h-4 w-4 text-white/45" /> : <ChevronRight className="h-4 w-4 text-white/45" />}
                </button>

                {sectionOpen ? (
                  <div className="mt-2 space-y-1 pl-1">
                    {group.items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href);
                      return (
                        <Link key={`${group.label}-${item.label}`} href={withRepo(item.href)} className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm transition duration-200 hover:bg-white/8 ${active ? 'bg-[#7C3AED]/15 text-white ring-1 ring-[#A78BFA]/30' : 'text-white/72'}`}>
                          <span>{item.label}</span>
                          <span className="text-[11px] uppercase tracking-[0.22em] text-white/35">{item.meta}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <div className="text-white/50">No repository ingested. Analyze a repository first.</div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-[24px] bg-[linear-gradient(135deg,#7C3AED_0%,#4C1D95_100%)] p-4 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-xl shadow-lg">🚀</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Analyze a new repo</p>
              <p className="mt-1 text-xs leading-5 text-white/80">Kick off ingestion, map the services, and review the findings.</p>
              <Link href="/new" className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#4C1D95] transition hover:-translate-y-0.5">
                <Rocket className="h-4 w-4" />
                Analyze now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
