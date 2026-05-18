"use client";

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileSearch,
  Info,
  Shield,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';

import { FindingCard } from '@/components/FindingCard';
import { StatCard } from '@/components/StatCard';
import { useRepoStore } from '@/lib/store';

const STATUS_MESSAGES = [
  'Scanning for security vulnerabilities...',
  'Analyzing authentication patterns...',
  'Checking for exposed secrets...',
  'Evaluating CORS and API security...',
  'Generating recommendations...',
  'Finalizing security report...',
];

export default function SecurityPage() {
  const findings = useRepoStore((state) => state.findings);
  const repoId = useRepoStore((state) => state.repoId);
  const fetchFindings = useRepoStore((state) => state.fetchFindings);
  const securityAnalysis = useRepoStore((state) => state.securityAnalysis);
  const isAnalyzing = useRepoStore((state) => state.isAnalyzing);
  const analysisError = useRepoStore((state) => state.analysisError);
  const nimStatus = useRepoStore((state) => state.nimStatus);
  const nimLatency = useRepoStore((state) => state.nimLatency);
  const nimModel = useRepoStore((state) => state.nimModel);
  const testNim = useRepoStore((state) => state.testNim);
  const analyzeSecurityWithAI = useRepoStore((state) => state.analyzeSecurityWithAI);
  const clearAnalysisError = useRepoStore((state) => state.clearAnalysisError);
  const setAnalysisError = useRepoStore((state) => state.setAnalysisError);
  const setIsAnalyzing = useRepoStore((state) => state.setIsAnalyzing);

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isTestingNim, setIsTestingNim] = useState(false);
  const [preflightMessage, setPreflightMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const autoStartedRef = useRef(false);

  const security = findings?.security ?? [];
  const critical = security.filter((finding) => finding.severity === 'critical').length;
  const warning = security.filter((finding) => finding.severity === 'warning').length;
  const info = security.filter((finding) => finding.severity === 'info').length;

  useEffect(() => {
    if (repoId && findings === null) {
      fetchFindings(repoId).catch(() => {});
    }
  }, [repoId, findings, fetchFindings]);

  useEffect(() => {
    if (!repoId || autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (!securityAnalysis && !isAnalyzing && !analysisError) {
      handleAnalyzeClick().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsed(0);
      return;
    }
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const safety = window.setTimeout(() => {
      setAnalysisError('Request timed out. NIM took too long to respond. Try switching to a smaller model in config.py.');
      setIsAnalyzing(false);
    }, 90000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(safety);
    };
  }, [isAnalyzing, setAnalysisError, setIsAnalyzing]);

  useEffect(() => {
    let timer: number | undefined;
    if (isAnalyzing) {
      timer = window.setInterval(() => {
        setStatusIndex((index) => (index + 1) % STATUS_MESSAGES.length);
      }, 3000);
    } else {
      setStatusIndex(0);
    }
    return () => {
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [isAnalyzing]);

  const handleAnalyzeClick = async () => {
    if (!repoId || isTestingNim || isAnalyzing) {
      return;
    }

    clearAnalysisError();
    setShowAnalysis(true);
    setIsTestingNim(true);
    setPreflightMessage('Testing NVIDIA NIM connection...');

    setShowAnalysis(true);
    const ok = await testNim();
    setIsTestingNim(false);

    if (!ok) {
      setPreflightMessage('');
      setShowAnalysis(true);
      return;
    }

    const latestState = useRepoStore.getState();
    setPreflightMessage(`Connected to ${latestState.nimModel ?? nimModel ?? 'NVIDIA NIM'} (${latestState.nimLatency ?? nimLatency ?? 0}ms)`);
    window.setTimeout(() => {
      setPreflightMessage('');
      setShowAnalysis(true);
      analyzeSecurityWithAI().catch(() => {});
    }, 1000);
  };

  return (
    <div className="page-enter px-6 py-6 md:px-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-[#7C3AED]" />
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Security Analysis</h1>
          <span className="rounded-full bg-[#EFE8FF] px-3 py-1 text-sm font-semibold text-[#6D28D9]">{security.length}</span>
          <button
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleAnalyzeClick}
            disabled={!repoId || isTestingNim || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing…' : 'Run AI Analysis'}
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">A prioritized scan of security concerns across code, config, and infrastructure.</p>
        {(isTestingNim || preflightMessage) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            {isTestingNim ? <Wifi className="h-3.5 w-3.5 text-slate-400" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
            <span>{preflightMessage}</span>
          </div>
        )}
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={AlertTriangle} label="Critical Findings" value={String(critical)} accentClass="text-red-500" />
        <StatCard icon={AlertCircle} label="Warnings" value={String(warning)} accentClass="text-orange-500" />
        <StatCard icon={Info} label="Info" value={String(info)} accentClass="text-blue-500" />
        <StatCard icon={FileSearch} label="Files Scanned" value={String(findings ? security.length : 0)} accentClass="text-slate-500" />
      </section>

      <section className="mt-8 space-y-4">
        {showAnalysis && (
          <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">AI Security Recommendations</h2>

            {isAnalyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: '16px' }}>
                <div className="shield-loader">
                  <Shield size={48} className="shield-icon" />
                  <div className="shield-pulse" />
                  <div className="shield-pulse shield-pulse-2" />
                </div>
                <p className="analyzing-text">{STATUS_MESSAGES[statusIndex]}</p>
                <p style={{ fontSize: '11px', color: '#D1D5DB' }}>{elapsed}s elapsed · NIM may take up to 30s</p>
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>Powered by NVIDIA NIM</p>
              </div>
            ) : nimStatus === 'error' ? (
              <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <XCircle className="h-8 w-8 text-[#EF4444]" />
                <div className="text-base font-semibold text-red-600">NVIDIA NIM is unreachable</div>
                <div className="max-w-2xl font-mono text-[13px] text-gray-500">{analysisError || 'The connectivity test failed.'}</div>
                <div className="text-[12px] text-amber-600">Check your NVIDIA_API_KEY and NVIDIA_BASE_URL in .env</div>
                <div className="flex gap-3">
                  <button
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    onClick={handleAnalyzeClick}
                  >
                    Retry
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      clearAnalysisError();
                      setShowAnalysis(false);
                      setPreflightMessage('');
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : analysisError ? (
              <div className="mt-6 flex flex-col items-center gap-3 text-center">
                <XCircle className="h-8 w-8 text-[#EF4444]" />
                <div className="text-base font-semibold text-red-600">Analysis failed</div>
                <div className="max-w-2xl font-mono text-[13px] text-gray-500">{analysisError}</div>
                {analysisError.includes('NIM API') && (
                  <div className="text-[12px] text-amber-600">
                    Check that NVIDIA_API_KEY is set correctly in your .env file and the NIM endpoint is reachable.
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    onClick={handleAnalyzeClick}
                  >
                    Retry
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      clearAnalysisError();
                      setShowAnalysis(false);
                      setPreflightMessage('');
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : securityAnalysis ? (
              <div className="mt-4 prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900 prose-a:text-[#7C3AED]">
                <ReactMarkdown>{securityAnalysis}</ReactMarkdown>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Press Run AI Analysis to generate repository-specific recommendations.</div>
            )}
          </div>
        )}

        {security.length === 0 ? (
          <div className="rounded-md bg-emerald-50 p-6 text-emerald-800">
            <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6" /> No security issues detected in this repository.</div>
          </div>
        ) : (
          security.map((finding, idx) => <FindingCard key={`${finding.title}-${idx}`} finding={finding} />)
        )}
      </section>
    </div>
  );
}
