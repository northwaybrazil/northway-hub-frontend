export type AgentKind = 'CONVERSATIONAL' | 'REPORT_GENERATOR';
export type AgentUseCase = 'SDR' | 'SUPPORT';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface LoginTenant {
  id: string;
  name: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: LoginUser;
  tenant: LoginTenant;
}

export interface AgentIntegrationConfig {
  account_id?: string;
  access_token?: string;
  agent_token?: string;
  chatwoot_url?: string;
  [key: string]: unknown;
}

export interface ApiAgent {
  id: string;
  company_id: string;
  name: string;
  description: string;
  kind: AgentKind;
  use_case?: AgentUseCase | null;
  model: string;
  temperature: number;
  agent_cooldown_minutes: number;
  handoff_to_human: boolean;
  close_on_handoff: boolean;
  integration_type: 'CHATWOOT' | null;
  integration_config: AgentIntegrationConfig | null;
  system_prompt: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface CreateAgentPayload {
  name?: string;
  description?: string;
  kind?: AgentKind;
  use_case?: AgentUseCase;
  agent_cooldown_minutes?: number;
  handoff_to_human?: boolean;
  close_on_handoff?: boolean;
  integration?: {
    type: 'CHATWOOT';
    config: {
      account_id: string;
      access_token: string;
      agent_token: string;
      chatwoot_url?: string;
    };
  };
}

export interface PatchAgentPayload {
  name?: string;
  description?: string;
  kind?: AgentKind;
  use_case?: AgentUseCase;
  agent_cooldown_minutes?: number;
  handoff_to_human?: boolean;
  close_on_handoff?: boolean;
  model?: string;
  system_prompt?: string;
  metadata?: Record<string, unknown>;
  integration?: {
    type: 'CHATWOOT';
    config: {
      account_id?: string;
      access_token?: string;
      agent_token?: string;
      chatwoot_url?: string;
    };
  };
}

export interface EditableAgent {
  id?: string;
  company_id?: string;
  created_at?: string | null;
  name: string;
  description: string;
  kind: AgentKind;
  use_case?: AgentUseCase;
  agent_cooldown_minutes: number;
  handoff_to_human: boolean;
  close_on_handoff: boolean;
  integration: {
    type: 'CHATWOOT';
    config: {
      account_id: string;
      access_token: string;
      agent_token: string;
      chatwoot_url: string;
    };
  };
  model: string;
  system_prompt: string;
  metadata: Record<string, unknown>;
  metadata_knowledge_base: string;
}

export interface SessionPolicyRoutingWhen {
  status?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SessionPolicyRoutingTarget {
  type?: string;
  agent_id?: string | null;
  [key: string]: unknown;
}

export interface SessionPolicyRoutingRule {
  when?: SessionPolicyRoutingWhen;
  target?: SessionPolicyRoutingTarget;
  reason?: string;
  reason_code?: string;
  [key: string]: unknown;
}

export interface SessionPolicy {
  triage?: {
    allowed_classifications?: string[];
    [key: string]: unknown;
  };
  routing_rules?: SessionPolicyRoutingRule[];
  default_initial_agent_id?: string | null;
  default_agent_id?: string | null;
  initial_agent_id?: string | null;
  default_target?: SessionPolicyRoutingTarget;
  [key: string]: unknown;
}

export interface CompanySessionPolicyResponse {
  company_id?: string;
  session_policy: SessionPolicy | null;
}

export interface EditableSessionPolicyRoute {
  id: string;
  classification: string;
  agent_id: string;
}

export type KnowledgeFileStatus =
  | 'uploaded'
  | 'pending_binding'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'error'
  | 'deleting'
  | 'deleted';

export interface KnowledgeFile {
  id: string;
  company_id: string;
  agent_id: string;
  status: KnowledgeFileStatus;
  original_filename: string;
  sanitized_filename: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  storage_key: string;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  download_url: string | null;
}
