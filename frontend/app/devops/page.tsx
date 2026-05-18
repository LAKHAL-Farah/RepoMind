"use client";

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Container, GitBranch, ShieldAlert, XCircle } from 'lucide-react';

import { StatCard } from '@/components/StatCard';
import { useRepoStore } from '@/lib/store';
import type { Finding } from '@/lib/types';

export default function DevOpsPage() {
  const { findings, summary, repoId, fetchFindings } = useRepoStore();
  const devops = findings?.devops ?? [];

  useEffect(() => {
    if (repoId && !findings) {
      fetchFindings(repoId).catch(() => {});
    }
  }, [repoId, findings, fetchFindings]);

  const dockerfilesCount = summary?.docker_files?.length ?? 0;
  const ciCdCount = summary?.ci_cd_files?.length ?? 0;
  const healthMissing = devops.filter((finding) => finding.title.toLowerCase().includes('healthcheck')).length;
  const exposedPorts = devops.filter((finding) => finding.title.toLowerCase().includes('port')).length;

  const grouped = devops.reduce<Record<string, Finding[]>>((acc, finding) => {
    acc[finding.file] = acc[finding.file] ?? [];
    acc[finding.file].push(finding);
    return acc;
  }, {});

  return (
    <div className="page-enter px-6 py-6 md:px-8">
      <header>
        <div className="flex items-center gap-3">
          <Container className="h-8 w-8 text-[#7C3AED]" />
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">DevOps Analysis</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">Container and delivery hygiene across Dockerfiles and workflows.</p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Container} label="Dockerfiles Found" value={String(dockerfilesCount)} accentClass="text-[#7C3AED]" />
        <StatCard icon={GitBranch} label="CI/CD Pipelines" value={String(ciCdCount)} accentClass="text-blue-500" />
        <StatCard icon={AlertTriangle} label="Health Checks Missing" value={String(healthMissing)} accentClass="text-orange-500" />
        <StatCard icon={ShieldAlert} label="Exposed Ports" value={String(exposedPorts)} accentClass="text-red-500" />
      </section>

      <section className="mt-8 rounded-[24px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
        <h2 className="text-xl font-semibold text-slate-900">DevOps Findings by File</h2>
        <div className="mt-4 space-y-4">
          {devops.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md bg-emerald-50 p-6 text-emerald-800"><Container className="h-6 w-6" /> No DevOps findings detected in this repository.</div>
          ) : (
            Object.entries(grouped).map(([file, items]) => {
              const labels = [
                { label: 'Multi-stage build', found: items.some((finding) => finding.title.toLowerCase().includes('multi')) },
                { label: 'HEALTHCHECK', found: items.some((finding) => finding.title.toLowerCase().includes('healthcheck')) },
                { label: 'Non-root user', found: items.some((finding) => finding.title.toLowerCase().includes('non-root') || finding.title.toLowerCase().includes('non root')) },
                { label: 'No SSH port', found: items.some((finding) => finding.title.toLowerCase().includes('ssh')) },
              ];

              return (
                <article key={file} className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                  <p className="font-mono text-sm text-slate-600">{file}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {labels.map(({ label, found }) => (
                      <div key={label} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                        {found ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        <span className="text-sm text-slate-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
