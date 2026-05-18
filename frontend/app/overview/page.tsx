"use client";

import { useEffect, useState, useMemo } from 'react';
import { MoreHorizontal, GitBranch, Clock, Layers, Database, Zap, AlertTriangle, AlertCircle, Info, ShieldCheck, FileText, FileCode, Copy, Check, Terminal, Code2, LayoutGrid, Network, Server, Cpu, Box, Wifi, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

import { useRepoStore } from '@/lib/store';
import type { Finding } from '@/lib/types';

function getInterfaceMeta(repoKind?: string | null) {
  switch (repoKind) {
    case 'web_server':
      return { title: 'HTTP Routes', icon: Zap, empty: 'No HTTP routes detected.' , chip: 'APIs Found' };
    case 'cli_tool':
      return { title: 'CLI Commands', icon: Terminal, empty: 'This is a CLI tool — showing available commands.', chip: 'Commands' };
    case 'library':
      return { title: 'Public Interface', icon: Code2, empty: 'This is a library — showing exported public functions instead.', chip: 'Exports' };
    case 'gui_app':
      return { title: 'Key Components', icon: LayoutGrid, empty: 'This is a desktop application — no HTTP routes expected.', chip: 'Components' };
    case 'mixed':
      return { title: 'Interfaces & Routes', icon: Network, empty: 'Showing all detected interfaces.', chip: 'Interfaces' };
    default:
      return { title: 'Public Interface', icon: Code2, empty: 'Showing detected public interfaces.', chip: 'Exports' };
  }
}

export default function OverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('All Findings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { repoId, summary, services, findings, apis, fetchSummary, fetchServices, fetchFindings, fetchApis } = useRepoStore();
  const effectiveRepoId = repoId ?? searchParams.get('repoId');
  const architectureHref = effectiveRepoId ? `/architecture?repoId=${encodeURIComponent(effectiveRepoId)}` : '/architecture';

  useEffect(() => {
    if (!effectiveRepoId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSummary(effectiveRepoId),
      fetchFindings(effectiveRepoId),
      fetchServices(effectiveRepoId),
      fetchApis(effectiveRepoId),
    ]).then(() => setLoading(false)).catch((e) => { setError(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [effectiveRepoId, fetchSummary, fetchFindings, fetchServices, fetchApis]);

  const flattenedFindings: Finding[] = useMemo(() => {
    if (!findings) return [];
    return (['security', 'architecture', 'devops', 'code_quality'] as const).flatMap((key) => findings[key]);
  }, [findings]);

  const interfaceMeta = getInterfaceMeta(summary?.repo_kind);
  const InterfaceIcon = interfaceMeta.icon;
  const totalFiles = summary?.total_files ?? 0;
  const chunkCount = summary?.chunk_count ?? 0;
  const statCards = [
    { label: 'Critical Issues', count: flattenedFindings.filter((f) => f.severity === 'critical').length, accent: 'from-red-500/18 to-red-500/5', border: 'border-red-500', icon: <AlertTriangle className="h-5 w-5 text-red-600" /> , key: 'critical' },
    { label: 'Warnings', count: flattenedFindings.filter((f) => f.severity === 'warning').length, accent: 'from-orange-400/18 to-orange-400/5', border: 'border-orange-400', icon: <AlertCircle className="h-5 w-5 text-orange-500" />, key: 'warning' },
    { label: 'Info', count: flattenedFindings.filter((f) => f.severity === 'info').length, accent: 'from-blue-400/18 to-blue-400/5', border: 'border-blue-400', icon: <Info className="h-5 w-5 text-blue-500" />, key: 'info' },
    { label: 'Total Findings', count: flattenedFindings.length, accent: 'from-purple-500/18 to-purple-500/5', border: 'border-purple-500', icon: <ShieldCheck className="h-5 w-5 text-purple-600" />, key: 'all' },
  ];

  if (!effectiveRepoId) return <div className="px-6 py-6">No repository selected.</div>;

  if (error) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex items-center gap-3 text-red-700"><AlertTriangle className="h-5 w-5" />{error}</div>
          <div className="mt-3"><button onClick={() => { setError(null); setLoading(true); if (!effectiveRepoId) return; fetchSummary(effectiveRepoId).then(() => Promise.all([fetchFindings(effectiveRepoId), fetchServices(effectiveRepoId), fetchApis(effectiveRepoId)])).then(() => setLoading(false)).catch((e) => { setError(e.message); setLoading(false); }); }} className="mt-2 rounded bg-red-600 px-3 py-2 text-white">Retry</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter px-6 py-6 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <GitBranch className="h-5 w-5 text-slate-700" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{summary?.name ?? repoId}</h1>
                <a href={summary?.github_url} target="_blank" rel="noreferrer" className="text-sm text-slate-500 underline">View on GitHub</a>
              </div>
              <div className="mt-2 flex gap-2">
                {(summary?.languages ?? []).map((lang) => (
                  <span key={lang} className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#3B82F6]">{lang}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-[640px] items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="rounded-[10px] bg-white p-3 shadow flex items-center gap-3">
              <FileCode className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-xs text-slate-500">Total Files</div>
                <div className="text-2xl font-bold text-slate-900">{totalFiles}</div>
              </div>
            </div>
            <div className="rounded-[10px] bg-white p-3 shadow flex items-center gap-3">
              <Database className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-xs text-slate-500">Chunks Indexed</div>
                <div className="text-2xl font-bold text-slate-900">{chunkCount}</div>
              </div>
            </div>
            <div className="rounded-[10px] bg-white p-3 shadow flex items-center gap-3">
              <Layers className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-xs text-slate-500">Services</div>
                  <div className="text-2xl font-bold text-slate-900">{services.length}</div>
              </div>
            </div>
            <div className="rounded-[10px] bg-white p-3 shadow flex items-center gap-3">
              <InterfaceIcon className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-xs text-slate-500">{interfaceMeta.chip}</div>
                <div className="text-2xl font-bold text-slate-900">{summary?.apis_count ?? apis.length}</div>
              </div>
            </div>
          </div>

          <div className="w-[260px] rounded-[12px] bg-white p-3 shadow">
            <div className="flex items-center justify-between"><div className="text-xs text-slate-500"><Clock className="inline-block h-4 w-4 mr-2"/>Analyzed</div><div className="text-sm text-slate-700">{summary?.ingested_at ? `${Math.max(1, Math.floor((Date.now() - new Date(summary.ingested_at).getTime())/60000))} minutes ago` : '—'}</div></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#60A5FA_0%,#7C3AED_100%)]" style={{width: `${Math.min(100, Math.round((chunkCount/10000)*100))}%`}} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{chunkCount} / 10,000 chunks</div>
          </div>
        </div>
      </div>

      {/* Findings summary row */}
      <section className="mt-6 grid grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            onClick={() => router.push(`/security${card.key === 'all' ? '' : `?severity=${card.key}`}`)}
            className={`page-enter cursor-pointer rounded-[12px] border-l-4 ${card.border} bg-gradient-to-br ${card.accent} p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur-sm">{card.icon}</div>
              <div>
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="text-2xl font-bold text-slate-900">{card.count}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Detected Services */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Detected Services <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{(services.length)}</span></h2>
          <div />
        </div>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {services.length === 0 && !loading ? (
            <article className="min-w-[230px] rounded-[20px] border border-white/60 bg-white/75 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm">No services detected</article>
          ) : services.slice(0, 8).map((item, index) => (
            <article key={item.name} onClick={() => router.push(`${architectureHref}&service=${encodeURIComponent(item.name)}`)} className="page-enter min-w-[270px] rounded-[20px] border border-white/60 bg-gradient-to-br from-white/85 to-white/65 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ animationDelay: `${index * 65}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.type === 'nextjs' || item.type === 'vite' || item.type === 'nuxt' || item.type === 'angular' ? 'bg-blue-50 text-blue-700' : item.type === 'python' || item.type === 'spring' ? 'bg-emerald-50 text-emerald-700' : item.type === 'go' ? 'bg-cyan-50 text-cyan-700' : item.type === 'node' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                  {item.type === 'nextjs' || item.type === 'vite' || item.type === 'nuxt' || item.type === 'angular' ? <Layers className="h-5 w-5" /> : item.type === 'python' || item.type === 'spring' ? <Server className="h-5 w-5" /> : item.type === 'go' ? <Cpu className="h-5 w-5" /> : item.type === 'node' ? <Server className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                </div>
                <button className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                {item.has_dockerfile ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Containerized</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{item.type ?? 'service'}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{item.language || 'unknown'}</span>
                {item.port !== null && item.port !== undefined ? <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700"><Wifi className="h-3 w-3" />Port {item.port}</span> : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><FolderOpen className="h-3 w-3" />{item.file_count} files</span>
              </div>
              <div className="mt-3 border-t pt-2">
                {(item.files || []).slice(0,3).map((f) => (<div key={f} className="text-sm text-slate-600 truncate"><FileCode className="inline-block h-4 w-4 mr-2"/>{f.length > 28 ? `${f.slice(0,28)}...` : f}</div>))}
                {(item.files || []).length > 3 ? <div className="text-sm text-slate-500">+{(item.files || []).length - 3} more</div> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* API Routes */}
      <section className="mt-8 rounded-[24px] bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{interfaceMeta.title} <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{apis.length}</span></h2>
          <a className="text-sm text-slate-500 hover:underline" href={architectureHref}>View all →</a>
        </div>
        <div className="mt-4 overflow-hidden rounded-[12px] border border-slate-100">
          {apis.length === 0 ? (
            <div className="p-6 text-center text-slate-500"><InterfaceIcon className="mx-auto mb-2 h-5 w-5"/>{interfaceMeta.empty}</div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Route / Decorator</th>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Copy</th>
                </tr>
              </thead>
              <tbody>
                {apis.slice(0,8).map((a, i) => (
                  <tr key={`${a.route}-${i}`} className="odd:bg-white even:bg-[#FAFAFA] h-11">
                    <td className="px-5 py-2"><span className={`px-2 py-1 rounded text-xs font-semibold ${a.method === 'GET' ? 'bg-blue-100 text-blue-700' : a.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{a.method}</span></td>
                    <td className="px-5 py-2 text-sm text-slate-700">{a.route.length > 60 ? `${a.route.slice(0,60)}...` : a.route}</td>
                    <td className="px-5 py-2 text-sm text-slate-600"><FileCode className="inline-block h-4 w-4 mr-2"/>{a.file.length > 40 ? `${a.file.slice(0,40)}...` : a.file}</td>
                    <td className="px-5 py-2">
                      <CopyButton text={a.route} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Infrastructure Detected */}
      <section className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-[20px] bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Docker & Containers</h3>
            <div className="text-sm text-slate-500">{(summary?.docker_files || []).length} files</div>
          </div>
          <div className="mt-3 space-y-3">
            {(summary?.docker_files || []).length === 0 ? (
              <div className="text-sm text-slate-500">No Dockerfile detected</div>
            ) : (
              (summary?.docker_files || []).map((df) => {
                const dfFindings = (findings?.devops || []).filter((f) => f.file === df);
                const missingHealth = dfFindings.some((f) => f.title === 'Missing HEALTHCHECK');
                const singleStage = dfFindings.some((f) => f.title === 'Single-stage Docker build');
                return (
                  <div key={df} className="rounded-[12px] border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-800"><FileCode className="inline-block h-4 w-4 mr-2"/>{df}</div>
                      <div className="text-sm text-slate-600">Checklist</div>
                    </div>
                    <div className="mt-2 flex gap-4 text-sm text-slate-600">
                      <div>{missingHealth ? <span className="text-red-500">✕</span> : <span className="text-green-600">✓</span>} HEALTHCHECK</div>
                      <div>{singleStage ? <span className="text-red-500">✕</span> : <span className="text-green-600">✓</span>} Multi-stage</div>
                      <div><span className="text-gray-400">—</span> Non-root user</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-[20px] bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">CI/CD Pipelines</h3>
            <div className="text-sm text-slate-500">{(summary?.ci_cd_files || []).length} files</div>
          </div>
          <div className="mt-3 space-y-2">
            {(summary?.ci_cd_files || []).length === 0 ? (
              <div className="text-sm text-slate-500">No CI/CD configuration detected</div>
            ) : (
              (summary?.ci_cd_files || []).map((c) => (
                <div key={c} className="flex items-center justify-between rounded-[10px] border p-3">
                  <div className="text-sm text-slate-800">{c}</div>
                  <div className="text-xs rounded bg-slate-100 px-2 py-1 text-slate-700">{c.includes('.github/workflows') ? 'GitHub Actions' : c === '.travis.yml' ? 'Travis CI' : 'CI'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recent Files Table */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Repository Files</h2>
          <div className="flex items-center gap-3">
            {['All Files', 'Source Code', 'Config Files', 'Documentation'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1 text-sm ${activeTab === tab ? 'bg-[#7C3AED] text-white rounded' : 'text-slate-600 hover:bg-slate-100 rounded'}`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[12px] border border-slate-100">
          <table className="min-w-full">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <tr>
                <th className="px-4 py-3 w-8"><input type="checkbox" /></th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Issues</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.all_files || []).slice(0,15).map((f, i) => {
                const fileFindings = flattenedFindings.filter((ff) => ff.file === f);
                const severityOrder: Record<'critical' | 'warning' | 'info', number> = { critical: 3, warning: 2, info: 1 };
                const worst = fileFindings.reduce((acc, cur) => {
                  if (!acc) return cur.severity;
                  const currentSeverity = (cur.severity as keyof typeof severityOrder) in severityOrder ? (cur.severity as keyof typeof severityOrder) : 'info';
                  const accSeverity = (acc as keyof typeof severityOrder) in severityOrder ? (acc as keyof typeof severityOrder) : 'info';
                  return severityOrder[currentSeverity] > severityOrder[accSeverity] ? cur.severity : acc;
                }, undefined as string | undefined);
                const status = worst ? (worst === 'critical' ? 'Critical' : worst === 'warning' ? 'Warning' : 'Info') : 'Clean';
                return (
                  <tr key={f} className={`h-11 ${i%2===0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                    <td className="px-4 py-2"><input type="checkbox" /></td>
                    <td className="px-4 py-2 text-sm"><FileText className="inline-block h-4 w-4 mr-2"/>{f.split('/').pop()}</td>
                    <td className="px-4 py-2 text-sm font-mono text-slate-500">{f.replace(/\\/g, '/').split('/').slice(0,-1).join('/') || '.'}</td>
                    <td className="px-4 py-2 text-sm">{f.endsWith('.py') ? 'Python' : f.endsWith('.java') ? 'Java' : f.endsWith('.ts') ? 'TypeScript' : ''}</td>
                    <td className="px-4 py-2 text-sm">—</td>
                    <td className="px-4 py-2 text-sm"><span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{fileFindings.length}</span></td>
                    <td className="px-4 py-2 text-sm">{status === 'Clean' ? <span className="text-green-600">Clean</span> : <span className="text-red-600">{status}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Insight Cards */}
      <section className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-[12px] bg-white p-4 shadow">
          <h4 className="text-sm font-semibold">Security Posture</h4>
          <div className="mt-3 h-4 bg-slate-100 rounded overflow-hidden">
            {/* stacked bar */}
            <div className="h-full bg-red-500" style={{width: `${flattenedFindings.filter(f => f.severity==='critical').length ? Math.min(100, flattenedFindings.filter(f => f.severity==='critical').length) : 0}%`}} />
          </div>
          <div className="mt-3 text-sm text-slate-600">Most severe: {flattenedFindings[0]?.title ?? '—'}</div>
        </div>

        <div className="rounded-[12px] bg-white p-4 shadow">
          <h4 className="text-sm font-semibold">Architecture Health</h4>
          <div className="mt-3 text-sm text-slate-600">Type: {services.length > 2 ? 'Microservices' : services.length > 0 ? 'Modular' : 'Monolith'}</div>
          <div className="mt-2 text-sm text-slate-600">Services: {services.length} · APIs: {summary?.apis_count ?? apis.length}</div>
        </div>

        <div className="rounded-[12px] bg-white p-4 shadow">
          <h4 className="text-sm font-semibold">DevOps Readiness</h4>
          <div className="mt-3 text-sm text-slate-600">Containerized: {(summary?.docker_files || []).length ? 'Yes' : 'No'}</div>
          <div className="mt-1 text-sm text-slate-600">CI/CD: {(summary?.ci_cd_files || []).length ? 'Yes' : 'No'}</div>
          <div className="mt-1 text-sm text-slate-600">Health Checks Present: {!(findings?.devops || []).some(f=>f.title==='Missing HEALTHCHECK') ? 'Yes' : 'No'}</div>
        </div>
      </section>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }); }} className="rounded p-1 text-slate-600 hover:bg-slate-100">
      {ok ? <Check className="h-4 w-4 text-green-600"/> : <Copy className="h-4 w-4" />}
    </button>
  );
}
