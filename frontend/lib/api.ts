const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ChatHistoryMessage = { role: string; content: string };

export class ApiError extends Error {
  status: number;
  endpoint: string;
  serverMessage?: string;
  constructor(status: number, endpoint: string, serverMessage?: string) {
    super(`${endpoint} failed with status ${status}: ${serverMessage ?? ''}`);
    this.status = status;
    this.endpoint = endpoint;
    this.serverMessage = serverMessage;
  }
}

async function handleResponse(endpoint: string, res: Response) {
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const payload = json as { detail?: string; message?: string } | undefined;
    const message = payload?.detail || payload?.message || text || res.statusText;
    throw new ApiError(res.status, endpoint, message);
  }
  return json;
}

export const api = {
  ingest: async (githubUrl: string) => {
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_url: githubUrl }),
    });
    return handleResponse('/api/ingest', res);
  },

  getAnalysis: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/analyze/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/analyze', res);
  },

  getFindings: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/analyze/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/analyze', res);
  },

  getServices: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/services/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/services', res);
  },

  getApis: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/apis/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/apis', res);
  },

  getRepoSummary: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/summary/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/summary', res);
  },

  analyzeSecurityWithAI: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/security/analyze/${encodeURIComponent(repoId)}`, {
      method: 'POST',
    });
    return handleResponse('/api/security/analyze', res);
  },

  testNim: async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${BASE_URL}/api/nim/test`, { signal: controller.signal });
      return handleResponse('/api/nim/test', res);
    } finally {
      window.clearTimeout(timeout);
    }
  },

  chat: async (repoId: string, question: string, history: ChatHistoryMessage[] = []) => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, question, history }),
    });
    return handleResponse('/api/chat', res);
  },

  getSuggestions: async (repoId: string) => {
    const res = await fetch(`${BASE_URL}/api/chat/suggestions/${encodeURIComponent(repoId)}`);
    return handleResponse('/api/chat/suggestions', res);
  },

  getHealth: async () => {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse('/health', res);
  },
};

export default api;
