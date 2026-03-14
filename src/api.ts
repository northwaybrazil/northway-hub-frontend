import type {
  ApiAgent,
  AuthSession,
  CompanySessionPolicyResponse,
  CreateAgentPayload,
  KnowledgeFile,
  LoginPayload,
  PatchAgentPayload,
  SessionPolicy
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

const buildUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const extractMessageFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = payload as Record<string, unknown>;

  if (Array.isArray(value.message)) {
    return value.message.join(', ');
  }

  if (typeof value.message === 'string') {
    return value.message;
  }

  if (typeof value.error_message === 'string') {
    return value.error_message;
  }

  if (typeof value.error === 'string') {
    return value.error;
  }

  if (value.error && typeof value.error === 'object') {
    const nestedError = value.error as Record<string, unknown>;
    if (typeof nestedError.message === 'string') {
      return nestedError.message;
    }
  }

  return null;
};

const extractCodeFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = payload as Record<string, unknown>;

  if (typeof value.error_code === 'string') {
    return value.error_code;
  }

  if (typeof value.code === 'string') {
    return value.code;
  }

  if (value.error && typeof value.error === 'object') {
    const nestedError = value.error as Record<string, unknown>;
    if (typeof nestedError.error_code === 'string') {
      return nestedError.error_code;
    }
    if (typeof nestedError.code === 'string') {
      return nestedError.code;
    }
  }

  return null;
};

const readErrorPayload = async (
  response: Response
): Promise<{
  message: string;
  code: string | null;
}> => {
  const fallbackMessage = `${response.status} ${response.statusText}`.trim();

  try {
    const payload = await response.json();
    const message = extractMessageFromPayload(payload) ?? fallbackMessage;
    const code = extractCodeFromPayload(payload);

    return { message, code };
  } catch {
    // Ignore parsing issues and fall back to status text.
  }

  return {
    message: fallbackMessage,
    code: null
  };
};

const normalizeAgentsResponse = (payload: unknown): ApiAgent[] => {
  if (Array.isArray(payload)) {
    return payload as ApiAgent[];
  }

  if (payload && typeof payload === 'object') {
    const candidates = ['data', 'agents', 'items', 'results'] as const;
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as ApiAgent[];
      }
    }
  }

  return [];
};

const normalizeKnowledgeFilesResponse = (payload: unknown): KnowledgeFile[] => {
  if (Array.isArray(payload)) {
    return payload as KnowledgeFile[];
  }

  if (payload && typeof payload === 'object') {
    const candidates = ['data', 'files', 'items', 'results'] as const;
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as KnowledgeFile[];
      }
    }
  }

  return [];
};

const normalizeCompanySessionPolicyResponse = (payload: unknown): CompanySessionPolicyResponse => {
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>;
    const sessionPolicy =
      value.session_policy && typeof value.session_policy === 'object'
        ? (value.session_policy as SessionPolicy)
        : null;

    return {
      company_id: typeof value.company_id === 'string' ? value.company_id : undefined,
      session_policy: sessionPolicy
    };
  }

  return {
    session_policy: null
  };
};

const request = async <T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
): Promise<T> => {
  const headers = new Headers(init.headers);

  const hasJsonBody = init.body && !(init.body instanceof FormData);
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers
  });

  if (!response.ok) {
    const { message, code } = await readErrorPayload(response);
    throw new ApiRequestError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return undefined as T;
  }
};

export const api = {
  login: (payload: LoginPayload) =>
    request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getAgents: async (accessToken: string) => {
    const payload = await request<unknown>(
      '/api/agent-management/agents',
      { method: 'GET' },
      accessToken
    );
    return normalizeAgentsResponse(payload);
  },

  getKnowledgeFiles: async (accessToken: string, agentId: string) => {
    const payload = await request<unknown>(
      `/api/knowledge/files?agentId=${encodeURIComponent(agentId)}`,
      { method: 'GET' },
      accessToken
    );
    return normalizeKnowledgeFilesResponse(payload);
  },

  getCompanySessionPolicy: async (accessToken: string) => {
    const payload = await request<unknown>(
      '/api/multi-tenancy/company/session-policy',
      { method: 'GET' },
      accessToken
    );
    return normalizeCompanySessionPolicyResponse(payload);
  },

  uploadKnowledgeFile: (
    accessToken: string,
    payload: {
      file: File;
      agentId: string;
      metadataJson?: string;
      idempotencyKey?: string;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('agent_id', payload.agentId);

    if (payload.metadataJson) {
      formData.append('metadata_json', payload.metadataJson);
    }

    const headers = new Headers();
    if (payload.idempotencyKey) {
      headers.set('Idempotency-Key', payload.idempotencyKey);
    }

    return request<unknown>(
      '/api/knowledge/uploads',
      {
        method: 'POST',
        headers,
        body: formData
      },
      accessToken
    );
  },

  createAgent: (accessToken: string, payload: CreateAgentPayload) =>
    request<ApiAgent>(
      '/api/agent-management/agents',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      accessToken
    ),

  patchAgent: (agentId: string, accessToken: string, payload: PatchAgentPayload) =>
    request<ApiAgent>(
      `/api/agent-management/agents/${agentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      },
      accessToken
    ),

  deleteAgent: (agentId: string, accessToken: string) =>
    request<void>(
      `/api/agent-management/agents/${agentId}`,
      {
        method: 'DELETE'
      },
      accessToken
    ),

  patchCompanySessionPolicy: async (
    accessToken: string,
    companyId: string,
    sessionPolicy: SessionPolicy
  ) => {
    const payload = await request<unknown>(
      `/api/multi-tenancy/companies/${encodeURIComponent(companyId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          session_policy: sessionPolicy
        })
      },
      accessToken
    );
    return normalizeCompanySessionPolicyResponse(payload);
  }
};
