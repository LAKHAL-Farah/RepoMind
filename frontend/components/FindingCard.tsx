import { FileCode2 } from 'lucide-react';

import type { Finding } from '@/lib/types';

const severityClasses = {
  critical: { badge: 'bg-red-100 text-red-700 ring-red-200', bar: 'bg-red-500' },
  warning: { badge: 'bg-orange-100 text-orange-700 ring-orange-200', bar: 'bg-orange-500' },
  info: { badge: 'bg-blue-100 text-blue-700 ring-blue-200', bar: 'bg-blue-500' },
};

export function FindingCard({ finding }: { finding: Finding }) {
  const config = severityClasses[finding.severity];

  return (
    <article className="overflow-hidden rounded-[20px] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.1)] transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="grid grid-cols-[6px_1fr]">
        <div className={config.bar} />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ring-1 ${config.badge}`}>{finding.severity}</span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{finding.title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{finding.description}</p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.26em] text-slate-400">{finding.timestamp}</span>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
            <FileCode2 className="h-4 w-4 text-slate-500" />
            <span className="font-mono text-xs">{finding.file}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
