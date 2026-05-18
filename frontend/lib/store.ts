import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';
import type {
  IngestResponse,
  SummaryResponse,
  FindingsResponse,
  Service,
  Api as ApiType,
  ChatResponse,
  SuggestionsResponse,
  ChatMessage,
} from './types';

type RepoStore = {
  repoUrl: string;
  repoId: string | null;
  isIngesting: boolean;
  ingestError: string | null;
  summary: SummaryResponse | null;
  findings: FindingsResponse | null;
  services: Service[];
  apis: ApiType[];
  messages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  lastSources: { file: string; score: number }[];
  lastAgentUsed: string | null;
  suggestions: string[];
  isSuggestionsLoading: boolean;
  // Security AI analysis
  securityAnalysis: string | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  nimStatus: 'untested' | 'ok' | 'error';
  nimLatency: number | null;
  nimModel: string | null;

  ingestRepo: (url: string) => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  fetchSummary: (repoId: string) => Promise<void>;
  fetchFindings: (repoId: string) => Promise<void>;
  fetchServices: (repoId: string) => Promise<void>;
  fetchApis: (repoId: string) => Promise<void>;
  fetchSuggestions: (repoId: string) => Promise<void>;
  setRepoId: (repoId: string | null) => void;
  clearMessages: () => void;
  reset: () => void;
  clearAnalysisError: () => void;
  setAnalysisError: (message: string | null) => void;
  setIsAnalyzing: (value: boolean) => void;
  testNim: () => Promise<boolean>;
};

export const useRepoStore = create<RepoStore>()(
  persist(
    (set, get) => ({
      repoUrl: '',
      repoId: null,
      isIngesting: false,
      ingestError: null,
      summary: null,
      findings: null,
      services: [],
      apis: [],
      messages: [],
      isChatLoading: false,
      chatError: null,
      lastSources: [],
      lastAgentUsed: null,
      suggestions: [],
      isSuggestionsLoading: false,
      securityAnalysis: null,
      isAnalyzing: false,
      analysisError: null,
      nimStatus: 'untested',
      nimLatency: null,
      nimModel: null,

      ingestRepo: async (url: string) => {
        set({ isIngesting: true, ingestError: null, repoUrl: url });
        try {
          const res: IngestResponse = await api.ingest(url);
          set({ repoId: res.repo_id, summary: { repo_id: res.repo_id, name: url.split('/').pop() || res.repo_id, languages: res.languages, services_count: res.services.length, apis_count: 0, chunk_count: res.chunk_count, findings_count: res.findings_count, docker_files: [], ci_cd_files: [] }, isIngesting: false });

          const repoId = res.repo_id;
          // fetch details in parallel
          await Promise.allSettled([
            get().fetchFindings(repoId),
            get().fetchServices(repoId),
            get().fetchApis(repoId),
            get().fetchSummary(repoId),
          ]);

          // redirect to overview
          if (typeof window !== 'undefined') {
            window.location.href = `/overview?repoId=${encodeURIComponent(repoId)}`;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Ingest failed';
          set({ ingestError: message, isIngesting: false });
        }
      },

      sendMessage: async (question: string) => {
        const repoId = get().repoId;
        if (!repoId || !question.trim()) return;
        const userMsg: ChatMessage = { id: String(Date.now()), role: 'user', content: question.trim(), timestamp: new Date().toISOString() };
        const history = [...get().messages]
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .slice(-6)
          .map((message) => ({ role: message.role, content: message.content }));
        set((state) => ({ messages: [...state.messages, userMsg], isChatLoading: true, chatError: null }));
        try {
          const res: ChatResponse = await api.chat(repoId, question.trim(), history);
          const botMsg: ChatMessage = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: res.answer,
            agent_used: res.agent_used,
            chunks_used: res.chunks_used,
            sources: res.sources,
            timestamp: new Date().toISOString(),
          };
          set((state) => ({
            messages: [...state.messages, botMsg],
            isChatLoading: false,
            lastSources: res.sources || [],
            lastAgentUsed: res.agent_used || null,
          }));
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Chat error';
          set({ chatError: message, isChatLoading: false });
        }
      },

      fetchSummary: async (repoId: string) => {
        try {
          const s = await api.getRepoSummary(repoId);
          set({ summary: s });
        } catch (e: unknown) {
          throw e instanceof Error ? e : new Error('Failed to fetch summary');
        }
      },

      fetchFindings: async (repoId: string) => {
        try {
          const f = await api.getFindings(repoId);
          set({ findings: f });
        } catch (e: unknown) {
          throw e instanceof Error ? e : new Error('Failed to fetch findings');
        }
      },

      fetchServices: async (repoId: string) => {
        try {
          const s = await api.getServices(repoId);
          set({ services: s.services || [] });
        } catch (e: unknown) {
          throw e instanceof Error ? e : new Error('Failed to fetch services');
        }
      },

      fetchApis: async (repoId: string) => {
        try {
          const a = await api.getApis(repoId);
          set({ apis: a.apis || [] });
        } catch (e: unknown) {
          throw e instanceof Error ? e : new Error('Failed to fetch apis');
        }
      },

      fetchSuggestions: async (repoId: string) => {
        set({ isSuggestionsLoading: true });
        try {
          const res: SuggestionsResponse = await api.getSuggestions(repoId);
          set({ suggestions: res.suggestions || [], isSuggestionsLoading: false });
        } catch {
          set({ suggestions: [], isSuggestionsLoading: false });
        }
      },

      setRepoId: (repoId: string | null) => {
        set({ repoId });
      },

      clearMessages: () => {
        set({ messages: [], lastSources: [], lastAgentUsed: null, chatError: null });
      },

      analyzeSecurityWithAI: async () => {
        const repoId = get().repoId;
        if (!repoId) return;
        set({ isAnalyzing: true, analysisError: null });
        try {
          const res = await api.analyzeSecurityWithAI(repoId);
          set({ securityAnalysis: res.analysis || null, isAnalyzing: false });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'AI analysis failed';
          set({ analysisError: message, isAnalyzing: false });
        }
      },

      clearAnalysisError: () => {
        set({ analysisError: null });
      },

      setAnalysisError: (message: string | null) => {
        set({ analysisError: message });
      },

      setIsAnalyzing: (value: boolean) => {
        set({ isAnalyzing: value });
      },

      testNim: async () => {
        try {
          const res = await api.testNim();
          if (res.status === 'ok') {
            set({ nimStatus: 'ok', nimLatency: res.latency_ms ?? null, nimModel: res.model ?? null });
            return true;
          }
          set({ nimStatus: 'error', nimLatency: null, nimModel: res.model ?? null, analysisError: res.error || 'NIM test failed' });
          return false;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'NIM test failed';
          set({ nimStatus: 'error', nimLatency: null, nimModel: null, analysisError: message });
          return false;
        }
      },

      reset: () => {
        set({ repoUrl: '', repoId: null, isIngesting: false, ingestError: null, summary: null, findings: null, services: [], apis: [], messages: [], isChatLoading: false, securityAnalysis: null, isAnalyzing: false, analysisError: null, nimStatus: 'untested', nimLatency: null, nimModel: null });
        if (typeof window !== 'undefined') window.location.href = '/';
      },
    }),
    { name: 'repo-store' }
  )
);
