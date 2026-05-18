"use client";

export function ServiceTopology() {
  const stages = [
    { label: 'Frontend', accent: '#7C3AED' },
    { label: 'API Gateway', accent: '#3B82F6' },
    { label: 'UserService', accent: '#7C3AED' },
    { label: 'AuthService', accent: '#8B5CF6' },
    { label: 'InterviewService', accent: '#A78BFA' },
    { label: 'MySQL', accent: '#14B8A6' },
    { label: 'Redis', accent: '#F97316' },
  ];

  const arrows = [180, 372, 564, 756, 948, 1140];

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
      <div className="relative overflow-x-auto pb-2">
        <div className="min-w-[1200px] py-3">
          <svg className="absolute left-0 top-[74px] h-[120px] w-full" viewBox="0 0 1240 120" fill="none" aria-hidden="true">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#94A3B8" />
              </marker>
            </defs>
            {arrows.map((x) => (
              <line key={x} x1={x} y1="60" x2={x + 120} y2="60" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrowhead)" />
            ))}
          </svg>

          <div className="relative z-10 flex items-start gap-8 px-1">
            {stages.map((stage, index) => (
              <div key={stage.label} className="min-w-[160px] rounded-[22px] border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm" style={{ borderLeftWidth: '5px', borderLeftColor: stage.accent }}>
                <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{index === 0 ? 'UI' : index === 1 ? 'Routing' : index < 5 ? 'Domain' : 'Infra'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
