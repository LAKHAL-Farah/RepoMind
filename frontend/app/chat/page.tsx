"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
  AlertCircle,
  Bot,
  BookOpen,
  Code2,
  Container,
  Copy,
  Database,
  Download,
  FileCode,
  FileSearch,
  GitBranch,
  Globe,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Network,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';

import { useRepoStore } from '@/lib/store';
import type { ChatMessage } from '@/lib/types';

const LOADING_STATES = ['Searching repository...', 'Routing to agent...', 'Generating response...'];
const GENERIC_QUESTIONS = [
  'What does this repository do?',
  'What are the main languages and frameworks used?',
  'How is the codebase structured?',
];

const agentMeta: Record<string, { label: string; bg: string; text: string; icon: typeof ShieldCheck }> = {
  Security: { label: 'Security', bg: '#FEE2E2', text: '#DC2626', icon: ShieldCheck },
  DevOps: { label: 'DevOps', bg: '#FEF3C7', text: '#D97706', icon: Container },
  Architecture: { label: 'Architecture', bg: '#DBEAFE', text: '#2563EB', icon: Network },
  CodeQuality: { label: 'CodeQuality', bg: '#F3E8FF', text: '#7C3AED', icon: Code2 },
  General: { label: 'General', bg: '#F3F4F6', text: '#6B7280', icon: Bot },
};

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isFilePathToken(token: string) {
  return /[\\/]/.test(token) && /\.[a-zA-Z0-9]+$/.test(token);
}

const markdownComponents = {
  p: ({ children }: { children: React.ReactNode }) => <p className="text-[13px] font-medium leading-6 text-slate-800">{children}</p>,
  strong: ({ children }: { children: React.ReactNode }) => <strong className="font-bold text-slate-900">{children}</strong>,
  em: ({ children }: { children: React.ReactNode }) => <em className="font-medium italic text-slate-800">{children}</em>,
  h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-[18px] font-bold text-slate-900">{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 className="mt-2 text-[15px] font-bold text-slate-900">{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 className="mt-1 text-[14px] font-bold text-slate-900">{children}</h3>,
  ul: ({ children }: { children: React.ReactNode }) => <ul className="space-y-2 pl-4 font-medium">{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol className="space-y-2 pl-4 font-medium">{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="flex gap-2 text-[13px] font-medium leading-6 text-slate-800">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
      <span>{children}</span>
    </li>
  ),
  code: ({ inline, children }: { inline?: boolean; children: React.ReactNode }) => {
    if (inline) {
      const text = String(children);
      if (isFilePathToken(text)) {
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-700">
            <FileCode className="h-3 w-3" />
            {text}
          </span>
        );
      }
      return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] font-semibold text-slate-800">{children}</code>;
    }
    return <code className="inline-flex max-w-full flex-wrap items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold leading-6 text-slate-800">{children}</code>;
  },
  pre: ({ children }: { children: React.ReactNode }) => <span className="inline">{children}</span>,
  blockquote: ({ children }: { children: React.ReactNode }) => <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-700">{children}</blockquote>,
};

function sourceBadgeColor(score: number) {
  if (score > 0.8) return { bg: '#DCFCE7', text: '#15803D' };
  if (score >= 0.6) return { bg: '#FEF3C7', text: '#D97706' };
  return { bg: '#F3F4F6', text: '#6B7280' };
}

function AgentBadge({ agent, small = false }: { agent: string; small?: boolean }) {
  const meta = agentMeta[agent] ?? agentMeta.General;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${small ? 'px-2 py-1 text-[10px]' : 'px-3 py-1 text-[11px]'}`}
      style={{ background: meta.bg, color: meta.text }}
    >
      <Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {meta.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const queryRepoId = searchParams.get('repoId');

  const summary = useRepoStore((state) => state.summary);
  const repoId = useRepoStore((state) => state.repoId);
  const setRepoId = useRepoStore((state) => state.setRepoId);
  const clearMessages = useRepoStore((state) => state.clearMessages);
  const messages = useRepoStore((state) => state.messages);
  const sendMessage = useRepoStore((state) => state.sendMessage);
  const isChatLoading = useRepoStore((state) => state.isChatLoading);
  const chatError = useRepoStore((state) => state.chatError);
  const lastSources = useRepoStore((state) => state.lastSources);
  const lastAgentUsed = useRepoStore((state) => state.lastAgentUsed);
  const suggestions = useRepoStore((state) => state.suggestions);
  const isSuggestionsLoading = useRepoStore((state) => state.isSuggestionsLoading);
  const fetchSummary = useRepoStore((state) => state.fetchSummary);
  const fetchSuggestions = useRepoStore((state) => state.fetchSuggestions);
  const services = useRepoStore((state) => state.services);

  const [input, setInput] = useState('');
  const [clearPrompt, setClearPrompt] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const activeRepoId = queryRepoId || repoId;
  const activeSummary = summary && summary.repo_id === activeRepoId ? summary : null;
  const repoName = activeSummary?.name ?? 'this repository';
  const chunkCount = activeSummary?.chunk_count ?? 0;
  const serviceCount = activeSummary?.services_count ?? services.length;
  const modelName = 'meta/llama-3.1-8b-instruct';

  const sidebarSuggestions = useMemo(() => {
    if (suggestions.length > 0) return suggestions.slice(0, 3);
    return GENERIC_QUESTIONS;
  }, [suggestions]);

  useEffect(() => {
    if (!activeRepoId) return;
    if (repoId !== activeRepoId) {
      setRepoId(activeRepoId);
      clearMessages();
    }
    fetchSummary(activeRepoId).catch(() => {});
    fetchSuggestions(activeRepoId).catch(() => {});
  }, [activeRepoId, repoId, setRepoId, clearMessages, fetchSummary, fetchSuggestions]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isChatLoading]);

  useEffect(() => {
    if (!isChatLoading) {
      setElapsed(0);
      return;
    }
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const phase = window.setInterval(() => setLoadingIndex((value) => (value + 1) % LOADING_STATES.length), 2000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(phase);
    };
  }, [isChatLoading]);

  const handleSend = async (question?: string) => {
    const prompt = (question ?? input).trim();
    if (!prompt || isChatLoading || !activeRepoId) return;
    setInput('');
    await sendMessage(prompt);
  };

  const handleSuggestionClick = async (question: string) => {
    setInput(question);
    await handleSend(question);
  };

  const handleExportChat = () => {
    const lines = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`);
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSummary?.name ?? 'repo'}-chat.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const currentSources = latestAssistant?.sources ?? lastSources;
  const currentAgent = latestAssistant?.agent_used ?? lastAgentUsed;

  const handleAssistantLike = (messageId: string) => {
    setLikedIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
  };

  const loadingStatus = LOADING_STATES[loadingIndex];

  return (
    <div className="page-enter flex h-[calc(100vh-3rem)] overflow-hidden px-0 py-0">
      <div className="flex h-full w-full gap-0 overflow-hidden">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-4 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#7C3AED]" />
              <h1 className="text-sm font-semibold text-slate-900">Repository Context</h1>
            </div>
          </div>

          <div className="border-b border-[#E5E7EB] px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <GitBranch className="h-4 w-4 text-slate-500" />
              <span className="truncate">{repoName}</span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-sm text-slate-500">
              <Globe className="mt-0.5 h-4 w-4 shrink-0" />
              {activeSummary?.github_url ? (
                <a href={activeSummary.github_url} target="_blank" rel="noreferrer" className="truncate text-slate-500 hover:text-[#7C3AED]" title={activeSummary.github_url}>
                  {activeSummary.github_url.length > 30 ? `${activeSummary.github_url.slice(0, 30)}...` : activeSummary.github_url}
                </a>
              ) : (
                <span className="truncate">No GitHub URL available</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(activeSummary?.languages ?? []).map((language) => (
                <span key={language} className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[10px] font-semibold text-[#6D28D9]">
                  {language}
                </span>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                <FileSearch className="h-3 w-3" />
                {activeSummary?.total_files ?? 0} files
              </div>
              <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                <Database className="h-3 w-3" />
                {chunkCount} chunks
              </div>
              <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                <Layers className="h-3 w-3" />
                {serviceCount} services
              </div>
            </div>
          </div>

          <div className="border-b border-[#E5E7EB] px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <Lightbulb className="h-3.5 w-3.5" />
              Suggested Questions
            </div>
            <div className="mt-3 space-y-2">
              {isSuggestionsLoading
                ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-9 rounded-lg bg-slate-100 animate-pulse" />)
                : sidebarSuggestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-left text-[12px] text-slate-600 transition duration-150 hover:border-[#7C3AED] hover:bg-[#F5F3FF] hover:text-[#7C3AED]"
                      onClick={() => handleSuggestionClick(question)}
                    >
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{question}</span>
                    </button>
                  ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <FileSearch className="h-3.5 w-3.5" />
              Sources Used
            </div>
            <div className="mt-3 space-y-2">
              {messages.length === 0 ? (
                <div className="text-[12px] italic text-slate-400">No specific code referenced</div>
              ) : currentSources.length > 0 ? (
                currentSources.map((source) => {
                  const color = sourceBadgeColor(source.score);
                  const fileName = source.file.length > 28 ? `${source.file.slice(0, 28)}...` : source.file;
                  return (
                    <div key={`${source.file}-${source.score}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[12px] text-slate-600">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileCode className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate font-mono">{fileName}</span>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: color.bg, color: color.text }}>
                        {Math.round(source.score * 100)}%
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-[12px] italic text-slate-400">No specific code referenced</div>
              )}
            </div>
          </div>

          <div className="border-t border-[#E5E7EB] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Active Agent</div>
            {currentAgent ? (
              <div className="mt-3 space-y-2">
                <AgentBadge agent={currentAgent} />
                <div className="text-[11px] text-slate-500">Routes questions to specialized agents</div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(['Security', 'DevOps', 'Architecture', 'CodeQuality', 'General'] as const).map((agent) => (
                  <AgentBadge key={agent} agent={agent} small />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#F8F9FA]">
          <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-[#7C3AED]" />
              AI Repository Assistant
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Clear conversation"
                onClick={() => setClearPrompt((value) => !value)}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Export chat"
                onClick={handleExportChat}
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
          {clearPrompt && (
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-600">
              Clear conversation?{' '}
              <button className="ml-2 font-semibold text-[#7C3AED]" onClick={() => { clearMessages(); setClearPrompt(false); }}>
                Yes
              </button>
              <button className="ml-2 font-semibold text-slate-500" onClick={() => setClearPrompt(false)}>
                No
              </button>
            </div>
          )}

          <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center text-center">
                <Bot className="h-12 w-12 text-[#A78BFA]" />
                <p className="mt-4 text-[18px] font-semibold text-slate-900">Ask anything about {repoName}</p>
                <p className="mt-2 text-[14px] text-slate-500">I have read all {chunkCount} chunks of the codebase and I am ready to help.</p>
                <div className="mt-6 flex w-full max-w-xl flex-col gap-2">
                  {(suggestions.length > 0 ? suggestions.slice(0, 3) : GENERIC_QUESTIONS).map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-left text-[14px] text-slate-600 transition duration-150 hover:border-[#7C3AED] hover:bg-[#F5F3FF] hover:text-[#7C3AED]"
                      onClick={() => handleSuggestionClick(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message: ChatMessage) =>
                  message.role === 'user' ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[70%] rounded-[16px] rounded-br-[14px] bg-[#7C3AED] px-3 py-2 text-[12px] leading-4 text-white">
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className="mt-2 text-right text-[11px] text-white/70">{formatTime(message.timestamp)}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="group flex max-w-[80%] gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7C3AED]">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 rounded-[16px] rounded-bl-[14px] border border-[#E5E7EB] bg-white px-3 py-3 text-[12px] leading-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <AgentBadge agent={message.agent_used ?? 'General'} small />
                          <span className="text-[11px] text-slate-400">· {message.chunks_used ?? 0} chunks referenced</span>
                        </div>
                        <div className="mt-3 space-y-2 font-medium">
                          <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-slate-400">{formatTime(message.timestamp)}</div>
                          <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                            <CopyButton text={message.content} />
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition ${likedIds.includes(message.id) ? 'text-emerald-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                              onClick={() => handleAssistantLike(message.id)}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              Helpful
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                )}
                {isChatLoading && (
                  <div className="group flex max-w-[80%] gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7C3AED]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 rounded-[16px] rounded-bl-[14px] border border-[#E5E7EB] bg-white px-3 py-3 text-[12px] leading-4 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                      </div>
                      <div className="mt-3 text-[11px] text-slate-500">
                        Searching {Math.min(elapsed + 1, 6)} chunks · {loadingStatus}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-[#E5E7EB] bg-white p-4">
            <div className="flex items-end gap-3">
              <button
                type="button"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled
                title="File upload coming soon"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend().catch(() => {});
                  }
                }}
                placeholder={`Ask anything about ${repoName}... (Enter to send, Shift+Enter for new line)`}
                className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7C3AED] focus:ring-4 focus:ring-[rgba(124,58,237,0.1)] disabled:bg-slate-50"
                disabled={isChatLoading}
              />
              <button
                type="button"
                onClick={() => handleSend().catch(() => {})}
                disabled={!input.trim() || isChatLoading}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] disabled:bg-[#E5E7EB] disabled:text-slate-400"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              {isChatLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>NIM is thinking...</span>
                </>
              ) : chatError ? (
                <>
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{chatError}</span>
                </>
              ) : (
                <>
                  <span>Powered by NVIDIA NIM · {modelName} · {serviceCount} services indexed</span>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
