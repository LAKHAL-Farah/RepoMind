import { Database, FileCode2, FileText, FolderOpen, Lock, Users } from 'lucide-react';

import type { Finding } from '@/lib/types';

const fileIcons = {
  code: FileCode2,
  docs: FileText,
  data: Database,
  folder: FolderOpen,
};

export function FileRow({ row, index }: { row: Finding; index: number }) {
  const Icon = fileIcons['code'];

  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#7C3AED] focus:ring-[#7C3AED]" />
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F3EEFF] text-[#7C3AED]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.title}</p>
            <p className="text-xs text-slate-500">{row.category} — {row.severity}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#7C3AED] text-xs font-semibold text-white">M</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#3B82F6] text-xs font-semibold text-white">O</span>
          </div>
          <span className="text-sm text-slate-600">{row.owner}</span>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{row.date}</td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${row.status === 'Shared' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
          {row.status === 'Shared' ? <Users className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {row.status}
        </span>
      </td>
    </tr>
  );
}
