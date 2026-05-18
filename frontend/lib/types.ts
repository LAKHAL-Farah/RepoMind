export interface IngestResponse {
  repo_id: string;
  services: string[];
  languages: string[];
  chunk_count: number;
  findings_count: number;
}

export interface Finding {
  severity: string;
  category: string;
  title: string;
  description: string;
  file: string;
}

export interface FindingsResponse {
  security: Finding[];
  devops: Finding[];
  architecture: Finding[];
  code_quality: Finding[];
}

export interface Service {
  name: string;
  path: string;
  type: string | null;
  language: string;
  file_count: number;
  files: string[];
  has_dockerfile: boolean;
  port: number | null;
  entry_point: string | null;
}

export interface ServicesResponse {
  services_count: number;
  services: Service[];
}

export interface Api {
  method: string;
  route: string;
  file: string;
  kind?: 'HTTP' | 'CLI' | 'CLASS' | 'FUNC';
}

export interface ApisResponse {
  repo_kind: 'web_server' | 'cli_tool' | 'library' | 'gui_app' | 'mixed';
  apis: Api[];
}

export interface SummaryResponse {
  repo_id: string;
  name: string;
  github_url: string;
  repo_kind: 'web_server' | 'cli_tool' | 'library' | 'gui_app' | 'mixed';
  languages: string[];
  services_count: number;
  apis_count: number;
  total_files: number;
  chunk_count: number;
  findings_count: number;
  docker_files: string[];
  ci_cd_files: string[];
  ingested_at: string;
  all_files: string[];
}

export interface ChatResponse {
  answer: string;
  agent_used: string;
  chunks_used: number;
  sources: { file: string; score: number }[];
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  agent_used?: string;
  chunks_used?: number;
  sources?: { file: string; score: number }[];
  timestamp: string;
};

export interface SuggestionsResponse {
  suggestions: string[];
}
