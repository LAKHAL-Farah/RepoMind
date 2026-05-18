"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode,
  FolderOpen,
  Network,
  Check,
  FileText,
  AlertTriangle,
  Terminal,
  Code2,
  LayoutGrid,
  Server,
  Cpu,
  Box,
  Wifi,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { useRepoStore } from '@/lib/store';
import type { Api } from '@/lib/types';

function groupFilesByDirectory(files: string[]) {
  const groups: Record<string, string[]> = {};
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const directory = parts.length > 1 ? `${parts.slice(0, -1).join('/')}/` : './';
    const name = parts.at(-1) ?? normalized;
    groups[directory] = groups[directory] || [];
    groups[directory].push(name);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function groupApisByFile(apis: Api[]) {
  const grouped: Record<string, Api[]> = {};
  for (const api of apis) {
    grouped[api.file] = grouped[api.file] || [];
    grouped[api.file].push(api);
  }
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
}

function groupApisByKind(apis: Api[]) {
  const grouped: Record<string, Api[]> = {};
  for (const api of apis) {
    const kind = api.kind ?? (api.method && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method) ? 'HTTP' : 'FUNC');
    grouped[kind] = grouped[kind] || [];
    grouped[kind].push(api);
  }
  return Object.entries(grouped);
}

function getArchitectureMeta(repoKind?: string | null) {
  switch (repoKind) {
    case 'web_server':
      return { title: 'HTTP Routes', icon: Network, banner: null };
    case 'cli_tool':
      return { title: 'CLI Commands', icon: Terminal, banner: null };
    case 'library':
      return { title: 'Public Interface', icon: Code2, banner: null };
    case 'gui_app':
      return {
        title: 'Key Components',
        icon: LayoutGrid,
        banner: 'This is a desktop GUI application. Showing public classes and components instead of HTTP routes.',
      };
    case 'mixed':
      return { title: 'Interfaces & Routes', icon: Network, banner: null };
    default:
      return { title: 'Public Interface', icon: Code2, banner: null };
  }
}

function iconForFile(name: string) {
  if (name.endsWith('.md')) return FileText;
  return FileCode;
}

function formatLanguageBadge(language: string) {
  const palette: Record<string, string> = {
    python: 'bg-blue-50 text-blue-700',
    javascript: 'bg-yellow-50 text-yellow-700',
    typescript: 'bg-cyan-50 text-cyan-700',
    java: 'bg-orange-50 text-orange-700',
    go: 'bg-sky-50 text-sky-700',
    rust: 'bg-amber-50 text-amber-700',
  };
  return palette[language.toLowerCase()] ?? 'bg-slate-100 text-slate-700';
}

function getServiceVisual(serviceType?: string | null) {
  if (serviceType === 'nextjs' || serviceType === 'vite' || serviceType === 'angular' || serviceType === 'nuxt') {
    return { icon: LayoutGrid, className: 'bg-blue-50 text-blue-700', label: 'Frontend' };
  }
  if (serviceType === 'python' || serviceType === 'spring' || serviceType === 'dotnet') {
    return { icon: Server, className: 'bg-emerald-50 text-emerald-700', label: 'Backend' };
  }
  if (serviceType === 'go') {
    return { icon: Cpu, className: 'bg-cyan-50 text-cyan-700', label: 'Go Service' };
  }
  if (serviceType === 'node') {
    return { icon: Server, className: 'bg-amber-50 text-amber-700', label: 'Node Service' };
  }
  return { icon: Box, className: 'bg-slate-100 text-slate-700', label: 'Service' };
}

function isFrontendService(serviceType?: string | null) {
  return ['nextjs', 'vite', 'angular', 'nuxt'].includes(serviceType ?? '');
}

function isBackendService(serviceType?: string | null) {
  return ['python', 'spring', 'dotnet', 'go'].includes(serviceType ?? '');
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function ArchitecturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('service') ?? '';
  const repoParam = searchParams.get('repoId') ?? '';
  const serviceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { repoId, summary, services, apis, fetchSummary, fetchServices, fetchApis } = useRepoStore();
  const effectiveRepoId = repoId ?? repoParam;
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveRepoId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSummary(effectiveRepoId),
      fetchServices(effectiveRepoId),
      fetchApis(effectiveRepoId),
    ])
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [effectiveRepoId, fetchSummary, fetchServices, fetchApis]);

  useEffect(() => {
    if (!serviceParam || services.length === 0) return;
    const match = services.find((service) => service.name === serviceParam);
    if (!match) return;
    setExpandedServices((prev) => ({ ...prev, [match.name]: true }));
    const target = serviceRefs.current[match.name];
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [serviceParam, services]);

  const groupedByKind = useMemo(() => groupApisByKind(apis), [apis]);
  const repoKind = summary?.repo_kind ?? 'library';
  const interfaceMeta = getArchitectureMeta(repoKind);
  const InterfaceIcon = interfaceMeta.icon as LucideIcon;
  const visibleApis = useMemo(() => {
    if (repoKind === 'web_server') {
      return apis.filter((api) => (api.kind ?? 'HTTP') === 'HTTP' || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method));
    }
    if (repoKind === 'cli_tool') {
      return apis.filter((api) => (api.kind ?? api.method) === 'CLI');
    }
    if (repoKind === 'gui_app') {
      return apis.filter((api) => (api.kind ?? api.method) === 'CLASS');
    }
    if (repoKind === 'library') {
      return apis.filter((api) => (api.kind ?? api.method) === 'CLASS' || (api.kind ?? api.method) === 'FUNC');
    }
    return apis;
  }, [apis, repoKind]);
  const visibleGroupedApis = useMemo(() => groupApisByFile(visibleApis), [visibleApis]);
  const extensionStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of summary?.all_files ?? []) {
      const ext = file.includes('.') ? file.split('.').pop()?.toLowerCase() ?? '' : file.toLowerCase();
      counts.set(ext, (counts.get(ext) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [summary?.all_files]);

  if (error) {
    return (
      <div className="px-6 py-6">
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" />{error}</div>
          <button type="button" onClick={() => router.refresh()} className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white">Retry</button>
        </div>
      </div>
    );
  }

  const currentServices = services.length > 0 ? services : [];
  const frontendServices = currentServices.filter((service) => isFrontendService(service.type));
  const backendServices = currentServices.filter((service) => isBackendService(service.type));
  const topologyEdges = frontendServices.flatMap((frontend) => backendServices.map((backend) => ({ frontend, backend })));

  return (
    <div className="page-enter px-6 py-6 md:px-8">
      <header className="rounded-[20px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-[#7C3AED]" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Architecture Map</h1>
            <p className="mt-1 text-sm text-slate-500">{summary?.name ?? repoId ?? 'Repository'} · {summary?.github_url ? <a href={summary.github_url} target="_blank" rel="noreferrer" className="text-[#7C3AED] underline">Open GitHub</a> : 'Loading…'}</p>
          </div>
        </div>
      </header>

      {currentServices.length > 1 ? (
        <section className="mt-6 rounded-[20px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Service Topology</h2>
              <p className="mt-1 text-sm text-slate-500">Detected service relationships based on frontend and backend roles.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{currentServices.length} services</span>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-2 rounded-[18px] border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Frontends</div>
              {frontendServices.length > 0 ? frontendServices.map((service) => {
                const visual = getServiceVisual(service.type);
                const Icon = visual.icon;
                return (
                  <div key={`topology-front-${service.name}`} className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${visual.className}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{service.name}</div>
                        <div className="text-sm text-slate-500">{service.type ?? 'service'} {service.port != null ? `· :${service.port}` : ''}</div>
                      </div>
                    </div>
                    {service.port != null ? <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700"><Wifi className="h-3 w-3" />:{service.port}</span> : null}
                  </div>
                );
              }) : <div className="text-sm text-slate-500">No frontend-type services detected.</div>}
            </div>

            <div className="flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-inner">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-2 rounded-[18px] border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Backends</div>
              {backendServices.length > 0 ? backendServices.map((service) => {
                const visual = getServiceVisual(service.type);
                const Icon = visual.icon;
                return (
                  <div key={`topology-back-${service.name}`} className="flex items-center justify-between rounded-[14px] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${visual.className}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{service.name}</div>
                        <div className="text-sm text-slate-500">{service.type ?? 'service'} {service.port != null ? `· :${service.port}` : ''}</div>
                      </div>
                    </div>
                    {service.port != null ? <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700"><Wifi className="h-3 w-3" />:{service.port}</span> : null}
                  </div>
                );
              }) : <div className="text-sm text-slate-500">No backend-type services detected.</div>}
            </div>
          </div>

          {topologyEdges.length > 0 ? (
            <div className="mt-4 rounded-[16px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-700">Detected flows</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {topologyEdges.map(({ frontend, backend }) => (
                  <span key={`${frontend.name}-${backend.name}`} className="rounded-full bg-white px-3 py-1 shadow-sm">
                    {frontend.name}{frontend.port != null ? ` :${frontend.port}` : ''} → {backend.name}{backend.port != null ? ` :${backend.port}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-[20px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Detected Services</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{currentServices.length}</span>
          </div>

          <div className={`mt-4 max-h-[520px] overflow-y-auto pr-1 ${currentServices.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}`}>
            {loading && currentServices.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-40 animate-pulse rounded-[18px] bg-slate-100" />
                ))}
              </div>
            ) : currentServices.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-200 p-6 text-sm text-slate-500">No services detected.</div>
            ) : (
              currentServices.map((service) => {
                const isOpen = expandedServices[service.name] ?? service.name === serviceParam;
                const isSelected = service.name === serviceParam;
                const groupedFiles = groupFilesByDirectory(service.files ?? []);
                return (
                  <div
                    key={service.name}
                    ref={(node) => {
                      serviceRefs.current[service.name] = node;
                    }}
                    className={`rounded-[18px] border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? 'border-l-4 border-l-[#7C3AED]' : 'border-slate-200'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedServices((prev) => ({ ...prev, [service.name]: !isOpen }))}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${formatLanguageBadge(service.language || 'unknown')}`}>{service.language || 'unknown'}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{service.type ?? 'service'}</span>
                          {service.port != null ? <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-700"><Wifi className="h-3 w-3" />Port {service.port}</span> : null}
                          {service.has_dockerfile ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Containerized</span> : null}
                          <span className="text-sm text-slate-500">{service.file_count} files</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${getServiceVisual(service.type).className}`}>
                            {(() => {
                              const VisualIcon = getServiceVisual(service.type).icon;
                              return <VisualIcon className="h-4 w-4" />;
                            })()}
                          </div>
                          <h3 className="text-base font-semibold text-slate-900">{service.name}</h3>
                        </div>
                      </div>
                      {isOpen ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                    </button>

                    {isOpen ? (
                      <div className="border-t border-slate-100 p-4">
                        <div className="space-y-3">
                          {groupedFiles.map(([directory, filenames]) => (
                            <div key={directory} className="rounded-[14px] bg-slate-50 p-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <FolderOpen className="h-4 w-4 text-slate-500" />
                                <span>{directory}</span>
                              </div>
                              <div className="mt-2 space-y-1 pl-6">
                                {filenames.map((filename) => {
                                  const Icon = iconForFile(filename);
                                  return (
                                    <div key={`${directory}-${filename}`} className="flex items-center gap-2 text-sm text-slate-600">
                                      <Icon className="h-4 w-4 text-slate-400" />
                                      <span className="truncate">{filename}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-[20px] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <InterfaceIcon className="h-5 w-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">{interfaceMeta.title}</h2>
            </div>
            <button type="button" onClick={() => router.push('/overview')} className="text-sm font-medium text-[#7C3AED] hover:underline">View overview →</button>
          </div>

          {interfaceMeta.banner ? (
            <div className="mt-4 rounded-[14px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {interfaceMeta.banner}
            </div>
          ) : null}

          {loading && visibleApis.length === 0 ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded-[12px] bg-slate-100" />
              ))}
            </div>
          ) : visibleApis.length === 0 ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[16px] border border-dashed border-slate-200 p-6 text-sm text-slate-500">{interfaceMeta.empty}</div>
              <div className="rounded-[16px] bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-700">Debug scan summary</div>
                <div className="mt-2">Files scanned: {summary?.all_files?.length ?? 0}</div>
                <div className="mt-1">Extensions: {extensionStats.map(([ext, count]) => `${ext || 'no-ext'}(${count})`).join(', ') || 'none'}</div>
              </div>
            </div>
          ) : repoKind === 'mixed' ? (
            <div className="mt-4 max-h-[400px] overflow-y-auto rounded-[16px] border border-slate-100 p-3">
              <div className="space-y-4">
                {groupedByKind.map(([kind, kindApis]) => (
                  <div key={kind} className="overflow-hidden rounded-[14px] border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">{kind}</div>
                    {groupApisByFile(kindApis).map(([file, fileApis]) => (
                      <div key={`${kind}-${file}`} className="border-t border-slate-100">
                        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <FileCode className="mr-2 inline-block h-4 w-4" />{file}
                        </div>
                        <div className="divide-y divide-slate-100">
                          {fileApis.map((api, index) => (
                            <div key={`${kind}-${file}-${api.route}-${index}`} className="grid grid-cols-[120px_1fr_1fr] items-center gap-3 px-4 py-3 text-sm odd:bg-white even:bg-slate-50/70">
                              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${api.kind === 'HTTP' ? 'bg-blue-100 text-blue-700' : api.kind === 'CLI' ? 'bg-slate-100 text-slate-700' : api.kind === 'CLASS' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'}`}>{api.kind ?? api.method}</span>
                              <span className="font-mono text-slate-700" title={api.route}>{api.route.length > 60 ? `${api.route.slice(0, 60)}…` : api.route}</span>
                              <span className="text-slate-600">{api.file}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 max-h-[400px] overflow-y-auto rounded-[16px] border border-slate-100">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{repoKind === 'web_server' ? 'Method' : 'Type'}</th>
                    <th className="px-4 py-3">{repoKind === 'web_server' ? 'Route' : 'Signature'}</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">{repoKind === 'cli_tool' ? 'Run' : repoKind === 'web_server' ? 'Copy' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroupedApis.map(([file, fileApis]) => (
                    <Fragment key={file}>
                      <tr key={`${file}-header`} className="sticky top-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        <td className="px-4 py-2" colSpan={4}>
                          <FileCode className="mr-2 inline-block h-4 w-4" />
                          {file}
                        </td>
                      </tr>
                      {fileApis.map((api, index) => (
                        <tr key={`${file}-${api.route}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${repoKind === 'web_server' ? (api.method === 'GET' ? 'bg-blue-100 text-blue-700' : api.method === 'POST' ? 'bg-emerald-100 text-emerald-700' : api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' : api.method === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700') : api.kind === 'CLASS' ? 'bg-purple-100 text-purple-700' : api.kind === 'CLI' ? 'bg-slate-100 text-slate-700' : 'bg-cyan-100 text-cyan-700'}`}>
                              {repoKind === 'web_server' ? api.method : api.kind ?? api.method}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-700" title={api.route}>
                            {api.route.length > 80 ? `${api.route.slice(0, 80)}…` : api.route}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <FileCode className="mr-2 inline-block h-4 w-4 text-slate-400" />
                            {api.file}
                          </td>
                          <td className="px-4 py-3">
                            {repoKind === 'web_server' ? <CopyButton text={api.route} /> : repoKind === 'cli_tool' ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{`python main.py ${api.route}`}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
