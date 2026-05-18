import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  accentClass?: string;
  subtext?: string;
};

export function StatCard({ icon: Icon, label, value, accentClass = 'text-[#7C3AED]', subtext }: StatCardProps) {
  return (
    <div className="rounded-[16px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.1)] transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
          {subtext ? <p className="mt-1 text-xs text-slate-400">{subtext}</p> : null}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
