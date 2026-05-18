"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container, GitBranch, LayoutDashboard, MessageSquare, Plus, Settings, ShieldCheck } from 'lucide-react';

import { useRepoStore } from '@/lib/store';

const items = [
  { href: '/', icon: GitBranch, label: 'Home' },
  { href: '/overview', icon: LayoutDashboard, label: 'Overview' },
  { href: '/security', icon: ShieldCheck, label: 'Security' },
  { href: '/architecture', icon: Container, label: 'Architecture' },
  { href: '/devops', icon: Settings, label: 'DevOps' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/new', icon: Plus, label: 'Add Repo' },
];

export function IconDock() {
  const pathname = usePathname();
  const { repoId } = useRepoStore();

  const withRepo = (href: string) => (repoId && href !== '/' && href !== '/new' ? `${href}?repoId=${encodeURIComponent(repoId)}` : href);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-14 flex-col items-center justify-between border-r border-white/5 bg-dock py-4 text-white shadow-[0_0_30px_rgba(3,0,15,0.35)]">
      <div className="flex flex-col items-center gap-2">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-[#A78BFA] shadow-glass">
          <GitBranch className="h-5 w-5" />
        </div>
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          const resolvedHref = withRepo(href);
          return (
            <Link
              key={href}
              href={resolvedHref}
              aria-label={label}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/10 ${active ? 'bg-[#7C3AED] text-white shadow-glow' : 'text-white/70'}`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/35">
        <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" />
        dock
      </div>
    </aside>
  );
}
