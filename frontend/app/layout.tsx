import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { IconDock } from '@/components/IconDock';
import { TopBar } from '@/components/TopBar';

import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'RepoMind',
  description: 'AI Repository Intelligence Platform',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-screen bg-[#F8F9FA] text-slate-900 antialiased">
        <IconDock />
        <TopBar />
        <main className="min-h-screen bg-[#F8F9FA] pl-14 pt-12">
          <div className="page-enter">{children}</div>
        </main>
      </body>
    </html>
  );
}
