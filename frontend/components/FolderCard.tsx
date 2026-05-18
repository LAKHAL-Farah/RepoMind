import { FolderOpen } from 'lucide-react';

import type { Service } from '@/lib/types';

export function FolderCard({ folder }: { folder: Service }) {
  const palette = ['bg-[#7C3AED]', 'bg-[#3B82F6]', 'bg-emerald-500'];

  return (
    <div className="rounded-[24px] bg-[linear-gradient(135deg,#2B2142_0%,#1A1530_55%,#12101D_100%)] p-5 text-white shadow-[0_18px_50px_rgba(31,17,71,0.28)] transition duration-200 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#A78BFA]">
          <FolderOpen className="h-6 w-6" />
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">+12</span>
      </div>

      <h3 className="mt-6 text-lg font-semibold">{folder.name}</h3>
      <p className="mt-1 text-sm text-white/65">{folder.file_count ?? folder.files?.length ?? 0} files{folder.size ? `, ${folder.size}` : ''}</p>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex -space-x-2">
          {(folder.members ?? []).map((member, index) => (
            <span key={member} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#171428] text-xs font-semibold text-white ${palette[index % palette.length]}`}>
              {member}
            </span>
          ))}
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">Shared</div>
      </div>
    </div>
  );
}
