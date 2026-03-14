import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AgentTabs, type AgentTab } from '@components/agent-management/AgentTabs';
import { AgentsSettingsView } from '@components/agent-management/AgentsSettingsView';
import { AgentsSidebar } from '@components/agent-management/AgentsSidebar';
import { GeralTab } from '@components/agent-management/GeralTab';
import { InteligenciaTab } from '@components/agent-management/InteligenciaTab';
import { LoginForm } from '@components/agent-management/LoginForm';
import { MonitoramentoTab } from '@components/agent-management/MonitoramentoTab';
import { ApiRequestError, api } from './api';
import type {
  ApiAgent,
  AuthSession,
  CreateAgentPayload,
  EditableAgent,
  EditableSessionPolicyRoute,
  KnowledgeFile,
  PatchAgentPayload,
  SessionPolicy,
  SessionPolicyRoutingRule
} from './types';

const SESSION_STORAGE_KEY = 'agent_management_session';
const DEFAULT_CHATWOOT_URL = 'https://app.chatwoot.com';
const LOCAL_DEV_TOKEN_TYPE = 'LOCAL_DEV_FAKE';
const LOCAL_DEV_COMPANY_ID = 'local-dev-company';
const isTruthyEnvValue = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
const IS_LOCAL_DEV_MODE =
  import.meta.env.DEV && !isTruthyEnvValue(import.meta.env.VITE_DISABLE_LOCAL_MOCK as string | undefined);

type LoginFormState = {
  email: string;
  password: string;
};

type AppView = 'agents' | 'settings-agents';

const TOKEN_ERROR_CODES = [
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_CLAIMS_INVALID',
  'AUTH_TOKEN_MISSING'
] as const;

type TokenErrorCode = (typeof TOKEN_ERROR_CODES)[number];

const isTokenErrorCode = (value: string | null): value is TokenErrorCode => {
  if (!value) {
    return false;
  }

  return TOKEN_ERROR_CODES.includes(value as TokenErrorCode);
};

const createEmptyAgent = (): EditableAgent => ({
  name: '',
  description: '',
  kind: 'CONVERSATIONAL',
  use_case: 'SDR',
  agent_cooldown_minutes: 0,
  handoff_to_human: false,
  close_on_handoff: true,
  integration: {
    type: 'CHATWOOT',
    config: {
      account_id: '',
      access_token: '',
      agent_token: '',
      chatwoot_url: DEFAULT_CHATWOOT_URL
    }
  },
  model: '',
  system_prompt: '',
  metadata: {},
  metadata_knowledge_base: ''
});

const createEmptySessionPolicyRoute = (): EditableSessionPolicyRoute => ({
  id: crypto.randomUUID(),
  classification: '',
  agent_id: ''
});

const createEmptySessionPolicy = (): SessionPolicy => ({
  triage: {
    allowed_classifications: []
  },
  routing_rules: [],
  initial_agent_id: null
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isTriageAgentRoutingRule = (rule: SessionPolicyRoutingRule): boolean => {
  const context = isRecord(rule.when?.context) ? rule.when?.context : null;

  return (
    rule.when?.status === 'TRIAGING' &&
    typeof context?.issue_classification === 'string' &&
    rule.target?.type === 'AGENT'
  );
};

const buildReasonLabel = (classification: string): string =>
  `${classification
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')} specialist`;

const buildReasonCode = (classification: string): string =>
  `${classification
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase()}_SPECIALIST`;

const extractTriageRoutes = (sessionPolicy: SessionPolicy | null): EditableSessionPolicyRoute[] => {
  const routingRules = sessionPolicy?.routing_rules ?? [];
  const triageRoutes = routingRules
    .filter(isTriageAgentRoutingRule)
    .map((rule) => {
      const context = isRecord(rule.when?.context) ? rule.when?.context : {};
      return {
        id: crypto.randomUUID(),
        classification: String(context.issue_classification ?? ''),
        agent_id: typeof rule.target?.agent_id === 'string' ? rule.target.agent_id : ''
      };
    });

  if (triageRoutes.length > 0) {
    return triageRoutes;
  }

  const allowedClassifications = sessionPolicy?.triage?.allowed_classifications ?? [];
  if (allowedClassifications.length > 0) {
    return allowedClassifications.map((classification) => ({
      id: crypto.randomUUID(),
      classification,
      agent_id: ''
    }));
  }

  return [createEmptySessionPolicyRoute()];
};

const readDefaultInitialAgentId = (sessionPolicy: SessionPolicy | null): string => {
  if (!sessionPolicy) {
    return '';
  }

  const directCandidates = [
    sessionPolicy.initial_agent_id,
    sessionPolicy.default_agent_id,
    sessionPolicy.default_initial_agent_id
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  if (
    sessionPolicy.default_target?.type === 'AGENT' &&
    typeof sessionPolicy.default_target.agent_id === 'string'
  ) {
    return sessionPolicy.default_target.agent_id;
  }

  return '';
};

const writeDefaultInitialAgentId = (sessionPolicy: SessionPolicy, agentId: string | null): SessionPolicy => {
  const normalizedAgentId = agentId?.trim() ? agentId.trim() : null;

  if ('initial_agent_id' in sessionPolicy || 'default_initial_agent_id' in sessionPolicy) {
    const { default_initial_agent_id: _legacyInitialAgentId, ...nextPolicy } = sessionPolicy;
    return {
      ...nextPolicy,
      initial_agent_id: normalizedAgentId
    };
  }

  if ('default_agent_id' in sessionPolicy) {
    return {
      ...sessionPolicy,
      default_agent_id: normalizedAgentId
    };
  }

  if ('default_target' in sessionPolicy && isRecord(sessionPolicy.default_target)) {
    return {
      ...sessionPolicy,
      default_target: normalizedAgentId
        ? {
            ...sessionPolicy.default_target,
            type: 'AGENT',
            agent_id: normalizedAgentId
          }
        : {
            ...sessionPolicy.default_target,
            agent_id: null
          }
    };
  }

  return {
    ...sessionPolicy,
    initial_agent_id: normalizedAgentId
  };
};

const buildSessionPolicyPayload = (
  sourcePolicy: SessionPolicy,
  routes: EditableSessionPolicyRoute[],
  defaultInitialAgentId: string
): SessionPolicy => {
  const normalizedRoutes = routes.map((route) => ({
    classification: route.classification.trim(),
    agent_id: route.agent_id.trim()
  }));

  const hasIncompleteRoute = normalizedRoutes.some(
    (route) =>
      (route.classification && !route.agent_id) || (!route.classification && Boolean(route.agent_id))
  );

  if (hasIncompleteRoute) {
    throw new Error('Preencha classificacao e agente em todas as linhas de triagem.');
  }

  const completedRoutes = normalizedRoutes.filter((route) => route.classification && route.agent_id);
  const preservedRules = (sourcePolicy.routing_rules ?? []).filter((rule) => !isTriageAgentRoutingRule(rule));
  const allowedClassifications = Array.from(new Set(completedRoutes.map((route) => route.classification)));

  const nextPolicy: SessionPolicy = {
    ...sourcePolicy,
    triage: {
      ...(sourcePolicy.triage ?? {}),
      allowed_classifications: allowedClassifications
    },
    routing_rules: [
      ...preservedRules,
      ...completedRoutes.map((route) => ({
        when: {
          status: 'TRIAGING',
          context: {
            issue_classification: route.classification
          }
        },
        target: {
          type: 'AGENT',
          agent_id: route.agent_id
        },
        reason: buildReasonLabel(route.classification),
        reason_code: buildReasonCode(route.classification)
      }))
    ]
  };

  return writeDefaultInitialAgentId(nextPolicy, defaultInitialAgentId);
};

const mapApiAgentToEditable = (agent: ApiAgent): EditableAgent => {
  const metadata = agent.metadata ?? {};
  const knowledgeBase = typeof metadata.knowledge_base === 'string' ? metadata.knowledge_base : '';

  return {
    id: agent.id,
    company_id: agent.company_id,
    created_at: agent.created_at,
    name: agent.name ?? '',
    description: agent.description ?? '',
    kind: agent.kind ?? 'CONVERSATIONAL',
    use_case: agent.use_case ?? (agent.kind === 'CONVERSATIONAL' ? 'SDR' : undefined),
    agent_cooldown_minutes: agent.agent_cooldown_minutes ?? 0,
    handoff_to_human: agent.handoff_to_human ?? false,
    close_on_handoff: agent.close_on_handoff ?? true,
    integration: {
      type: 'CHATWOOT',
      config: {
        account_id: String(agent.integration_config?.account_id ?? ''),
        access_token: String(agent.integration_config?.access_token ?? ''),
        agent_token: String(agent.integration_config?.agent_token ?? ''),
        chatwoot_url: String(agent.integration_config?.chatwoot_url ?? DEFAULT_CHATWOOT_URL)
      }
    },
    model: agent.model ?? '',
    system_prompt: agent.system_prompt ?? '',
    metadata,
    metadata_knowledge_base: knowledgeBase
  };
};

const isLocalDevSession = (session: AuthSession | null): boolean =>
  Boolean(session && session.token_type === LOCAL_DEV_TOKEN_TYPE);

const createLocalDevSession = (email: string): AuthSession => {
  const normalizedEmail = email || 'dev@northway.local';

  return {
    access_token: 'local-dev-token',
    token_type: LOCAL_DEV_TOKEN_TYPE,
    user: {
      id: 'local-dev-user',
      email: normalizedEmail,
      role: 'ADMIN',
      status: 'ACTIVE'
    },
    tenant: {
      id: LOCAL_DEV_COMPANY_ID,
      name: 'Local Dev'
    }
  };
};

const mapEditableAgentToApiAgent = (agent: EditableAgent): ApiAgent => {
  const now = new Date().toISOString();
  const knowledgeBase = agent.metadata_knowledge_base.trim();
  const metadata = knowledgeBase
    ? {
        ...agent.metadata,
        knowledge_base: knowledgeBase
      }
    : { ...agent.metadata };

  return {
    id: agent.id ?? crypto.randomUUID(),
    company_id: agent.company_id ?? LOCAL_DEV_COMPANY_ID,
    name: agent.name,
    description: agent.description,
    kind: agent.kind,
    use_case: agent.kind === 'CONVERSATIONAL' ? (agent.use_case ?? 'SDR') : null,
    model: agent.model,
    temperature: 0,
    agent_cooldown_minutes: agent.agent_cooldown_minutes,
    handoff_to_human: agent.handoff_to_human,
    close_on_handoff: agent.close_on_handoff,
    integration_type: 'CHATWOOT',
    integration_config: {
      account_id: agent.integration.config.account_id,
      access_token: agent.integration.config.access_token,
      agent_token: agent.integration.config.agent_token,
      chatwoot_url: agent.integration.config.chatwoot_url
    },
    system_prompt: agent.system_prompt,
    metadata,
    created_at: agent.created_at ?? now
  };
};

const readSessionFromStorage = (): AuthSession | null => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (IS_LOCAL_DEV_MODE && session.token_type !== LOCAL_DEV_TOKEN_TYPE) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

const saveSessionToStorage = (session: AuthSession): void => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

const clearSessionFromStorage = (): void => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

const buildGeneralPayload = (agent: EditableAgent): CreateAgentPayload => {
  const payload: CreateAgentPayload = {};
  const name = agent.name.trim();
  const description = agent.description.trim();

  if (name) {
    payload.name = name;
  }

  if (description) {
    payload.description = description;
  }

  payload.kind = agent.kind;
  if (agent.kind === 'CONVERSATIONAL' && agent.use_case) {
    payload.use_case = agent.use_case;
  }

  if (agent.handoff_to_human) {
    payload.handoff_to_human = true;
  }

  if (!agent.close_on_handoff) {
    payload.close_on_handoff = false;
  }

  if (agent.agent_cooldown_minutes > 0) {
    payload.agent_cooldown_minutes = agent.agent_cooldown_minutes;
  }

  const accountId = agent.integration.config.account_id.trim();
  const accessToken = agent.integration.config.access_token.trim();
  const agentToken = agent.integration.config.agent_token.trim();
  const chatwootUrl = agent.integration.config.chatwoot_url.trim();

  const hasChatwootData = Boolean(
    accountId || accessToken || agentToken || (chatwootUrl && chatwootUrl !== DEFAULT_CHATWOOT_URL)
  );

  if (hasChatwootData) {
    if (!accountId || !accessToken || !agentToken) {
      throw new Error(
        'Preencha integration.config.account_id, integration.config.access_token e integration.config.agent_token.'
      );
    }

    payload.integration = {
      type: 'CHATWOOT',
      config: {
        account_id: accountId,
        access_token: accessToken,
        agent_token: agentToken,
        ...(chatwootUrl ? { chatwoot_url: chatwootUrl } : {})
      }
    };
  }

  return payload;
};

const buildIntelligencePayload = (agent: EditableAgent): PatchAgentPayload => {
  const payload: PatchAgentPayload = {};
  const model = agent.model.trim();
  const systemPrompt = agent.system_prompt.trim();
  const knowledgeBase = agent.metadata_knowledge_base.trim();

  if (model) {
    payload.model = model;
  }

  if (systemPrompt) {
    payload.system_prompt = systemPrompt;
  }

  if (knowledgeBase) {
    payload.metadata = {
      ...agent.metadata,
      knowledge_base: knowledgeBase
    };
  }

  return payload;
};

const upsertAgent = (current: ApiAgent[], incoming: ApiAgent): ApiAgent[] => {
  const index = current.findIndex((agent) => agent.id === incoming.id);
  if (index === -1) {
    return [incoming, ...current];
  }

  const next = [...current];
  next[index] = incoming;
  return next;
};

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSessionFromStorage());

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: '',
    password: ''
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [reauthForm, setReauthForm] = useState<LoginFormState>({
    email: '',
    password: ''
  });
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);

  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [activeView, setActiveView] = useState<AppView>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [editableAgent, setEditableAgent] = useState<EditableAgent>(() => createEmptyAgent());
  const [sessionPolicySource, setSessionPolicySource] = useState<SessionPolicy>(() => createEmptySessionPolicy());
  const [sessionPolicyRoutes, setSessionPolicyRoutes] = useState<EditableSessionPolicyRoute[]>(() => [
    createEmptySessionPolicyRoute()
  ]);
  const [defaultInitialAgentId, setDefaultInitialAgentId] = useState('');

  const [activeTab, setActiveTab] = useState<AgentTab>('geral');
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingSessionPolicy, setIsLoadingSessionPolicy] = useState(false);
  const [isLoadingKnowledgeFiles, setIsLoadingKnowledgeFiles] = useState(false);
  const [isUploadingKnowledgeFiles, setIsUploadingKnowledgeFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearWorkspaceState = useCallback((): void => {
    setAgents([]);
    setKnowledgeFiles([]);
    setActiveView('agents');
    setSelectedAgentId(null);
    setEditableAgent(createEmptyAgent());
    setSessionPolicySource(createEmptySessionPolicy());
    setSessionPolicyRoutes([createEmptySessionPolicyRoute()]);
    setDefaultInitialAgentId('');
    setActiveTab('geral');
    setStatusMessage(null);
    setErrorMessage(null);
    setReauthError(null);
    setIsReauthenticating(false);
    setIsReauthModalOpen(false);
  }, []);

  const forceLogout = useCallback(
    (nextAuthError: string | null, shouldClearLoginForm: boolean): void => {
      const emailHint = shouldClearLoginForm ? '' : loginForm.email || session?.user.email || '';

      clearSessionFromStorage();
      setSession(null);
      clearWorkspaceState();
      setAuthError(nextAuthError);
      setLoginForm({
        email: emailHint,
        password: ''
      });
      setReauthForm({
        email: emailHint,
        password: ''
      });
    },
    [clearWorkspaceState, loginForm.email, session]
  );

  const handleTokenAuthError = useCallback(
    (error: unknown): boolean => {
      if (!(error instanceof ApiRequestError)) {
        return false;
      }

      if (error.status !== 401 || !isTokenErrorCode(error.code)) {
        return false;
      }

      if (error.code === 'AUTH_TOKEN_EXPIRED') {
        setStatusMessage(null);
        setErrorMessage(null);
        setReauthError(null);
        setIsReauthenticating(false);
        setReauthForm((current) => ({
          email: current.email || session?.user.email || loginForm.email || '',
          password: ''
        }));
        setIsReauthModalOpen(true);
        return true;
      }

      forceLogout('Sessão inválida. Faça login novamente.', false);
      return true;
    },
    [forceLogout, loginForm.email, session]
  );

  const loadKnowledgeFilesForAgent = useCallback(
    async (agentId: string): Promise<void> => {
      if (!session) {
        return;
      }
      if (isLocalDevSession(session)) {
        setKnowledgeFiles([]);
        return;
      }

      setIsLoadingKnowledgeFiles(true);

      try {
        const files = await api.getKnowledgeFiles(session.access_token, agentId);
        setKnowledgeFiles(files);
      } catch (error) {
        if (handleTokenAuthError(error)) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Falha ao carregar arquivos da base de conhecimento.';
        setErrorMessage(message);
      } finally {
        setIsLoadingKnowledgeFiles(false);
      }
    },
    [handleTokenAuthError, session]
  );

  const applySessionPolicyToEditor = useCallback((policy: SessionPolicy | null): void => {
    const nextPolicy = policy ?? createEmptySessionPolicy();
    setSessionPolicySource(nextPolicy);
    setSessionPolicyRoutes(extractTriageRoutes(nextPolicy));
    setDefaultInitialAgentId(readDefaultInitialAgentId(nextPolicy));
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (isLocalDevSession(session)) {
      setIsLoadingAgents(false);
      setIsLoadingSessionPolicy(false);
      setErrorMessage(null);
      setAgents([]);
      setSelectedAgentId(null);
      setEditableAgent(createEmptyAgent());
      applySessionPolicyToEditor(createEmptySessionPolicy());
      return;
    }

    const loadAgents = async (): Promise<void> => {
      setIsLoadingAgents(true);
      setErrorMessage(null);

      try {
        const list = await api.getAgents(session.access_token);
        setAgents(list);

        if (list.length > 0) {
          setSelectedAgentId(list[0].id);
          setEditableAgent(mapApiAgentToEditable(list[0]));
        } else {
          setSelectedAgentId(null);
          setEditableAgent(createEmptyAgent());
        }
      } catch (error) {
        if (handleTokenAuthError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Falha ao carregar agentes.';
        setErrorMessage(message);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    void loadAgents();
  }, [applySessionPolicyToEditor, handleTokenAuthError, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (isLocalDevSession(session)) {
      return;
    }

    const loadSessionPolicy = async (): Promise<void> => {
      setIsLoadingSessionPolicy(true);

      try {
        const response = await api.getCompanySessionPolicy(
          session.access_token,
          session.tenant.id
        );
        applySessionPolicyToEditor(response.session_policy);
      } catch (error) {
        if (handleTokenAuthError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Falha ao carregar configuracoes.';
        setErrorMessage(message);
      } finally {
        setIsLoadingSessionPolicy(false);
      }
    };

    void loadSessionPolicy();
  }, [applySessionPolicyToEditor, handleTokenAuthError, session]);

  useEffect(() => {
    if (!session || !editableAgent.id) {
      setKnowledgeFiles([]);
      return;
    }

    void loadKnowledgeFilesForAgent(editableAgent.id);
  }, [session, editableAgent.id, loadKnowledgeFilesForAgent]);

  const clearMessages = (): void => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSelectAgent = (agentId: string): void => {
    const target = agents.find((agent) => agent.id === agentId);
    if (!target) {
      return;
    }

    clearMessages();
    setActiveView('agents');
    setKnowledgeFiles([]);
    setSelectedAgentId(target.id);
    setEditableAgent(mapApiAgentToEditable(target));
    setActiveTab('geral');
  };

  const handleNewAgent = (): void => {
    clearMessages();
    setActiveView('agents');
    setKnowledgeFiles([]);
    setSelectedAgentId(null);
    setEditableAgent(createEmptyAgent());
    setActiveTab('geral');
  };

  const handleOpenAgentsSettings = (): void => {
    clearMessages();
    setActiveView('settings-agents');
  };

  const handleAddSessionPolicyRoute = (): void => {
    setSessionPolicyRoutes((current) => [...current, createEmptySessionPolicyRoute()]);
  };

  const handleRemoveSessionPolicyRoute = (routeId: string): void => {
    setSessionPolicyRoutes((current) => current.filter((route) => route.id !== routeId));
  };

  const handleSessionPolicyRouteChange = (
    routeId: string,
    field: keyof Pick<EditableSessionPolicyRoute, 'classification' | 'agent_id'>,
    value: string
  ): void => {
    setSessionPolicyRoutes((current) =>
      current.map((route) => (route.id === routeId ? { ...route, [field]: value } : route))
    );
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      if (IS_LOCAL_DEV_MODE) {
        const localSession = createLocalDevSession(loginForm.email.trim());
        saveSessionToStorage(localSession);
        setSession(localSession);
        setReauthForm({
          email: localSession.user.email,
          password: ''
        });
        setReauthError(null);
        setIsReauthModalOpen(false);
        setStatusMessage('Sessão local iniciada (modo desenvolvimento, sem backend).');
        return;
      }

      const authenticatedSession = await api.login({
        email: loginForm.email.trim(),
        password: loginForm.password
      });

      saveSessionToStorage(authenticatedSession);
      setSession(authenticatedSession);
      setReauthForm({
        email: loginForm.email.trim(),
        password: ''
      });
      setReauthError(null);
      setIsReauthModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar.';
      setAuthError(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = (): void => {
    forceLogout(null, true);
  };

  const handleReauthSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setReauthError(null);
    setIsReauthenticating(true);

    try {
      const authenticatedSession = await api.login({
        email: reauthForm.email.trim(),
        password: reauthForm.password
      });

      saveSessionToStorage(authenticatedSession);
      setSession(authenticatedSession);
      setLoginForm({
        email: reauthForm.email.trim(),
        password: ''
      });
      setReauthForm((current) => ({
        ...current,
        password: ''
      }));
      setReauthError(null);
      setIsReauthModalOpen(false);
      setStatusMessage('Sessão renovada com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao renovar sessão.';
      setReauthError(message);
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleSaveGeral = async (): Promise<void> => {
    if (!session) {
      return;
    }

    clearMessages();
    setIsSaving(true);

    try {
      const payload = buildGeneralPayload(editableAgent);

      if (!payload.name) {
        throw new Error('name é obrigatório.');
      }

      if (isLocalDevSession(session)) {
        const localAgent = mapEditableAgentToApiAgent(editableAgent);
        const message = editableAgent.id
          ? 'Agente atualizado localmente (modo desenvolvimento).'
          : 'Agente criado localmente (modo desenvolvimento).';

        setAgents((current) => upsertAgent(current, localAgent));
        setEditableAgent(mapApiAgentToEditable(localAgent));
        setSelectedAgentId(localAgent.id);
        setStatusMessage(message);
        return;
      }

      if (editableAgent.id) {
        const updated = await api.patchAgent(editableAgent.id, session.access_token, payload);
        setAgents((current) => upsertAgent(current, updated));
        setEditableAgent(mapApiAgentToEditable(updated));
        setSelectedAgentId(updated.id);
        setStatusMessage('Agente atualizado com sucesso via PATCH.');
      } else {
        const created = await api.createAgent(session.access_token, payload);
        setAgents((current) => upsertAgent(current, created));
        setEditableAgent(mapApiAgentToEditable(created));
        setSelectedAgentId(created.id);
        setStatusMessage('Agente criado com sucesso via POST.');
      }
    } catch (error) {
      if (handleTokenAuthError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Falha ao salvar a aba Geral.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntelligence = async (): Promise<void> => {
    if (!session) {
      return;
    }

    clearMessages();

    if (!editableAgent.id) {
      setErrorMessage('Salve a aba Geral primeiro para criar o agente.');
      return;
    }

    setIsSaving(true);

    try {
      const payload = buildIntelligencePayload(editableAgent);

      if (Object.keys(payload).length === 0) {
        throw new Error('Nenhum campo da aba Inteligência foi preenchido.');
      }

      if (isLocalDevSession(session)) {
        const localAgent = mapEditableAgentToApiAgent(editableAgent);
        setAgents((current) => upsertAgent(current, localAgent));
        setEditableAgent(mapApiAgentToEditable(localAgent));
        setStatusMessage('Agente atualizado localmente (aba Inteligência).');
        return;
      }

      const updated = await api.patchAgent(editableAgent.id, session.access_token, payload);
      setAgents((current) => upsertAgent(current, updated));
      setEditableAgent(mapApiAgentToEditable(updated));
      setStatusMessage('Agente atualizado com sucesso via PATCH (aba Inteligência).');
    } catch (error) {
      if (handleTokenAuthError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Falha ao salvar a aba Inteligência.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSessionPolicy = async (): Promise<void> => {
    if (!session) {
      return;
    }

    clearMessages();
    setIsSaving(true);

    try {
      const payload = buildSessionPolicyPayload(
        sessionPolicySource,
        sessionPolicyRoutes,
        defaultInitialAgentId
      );

      if (isLocalDevSession(session)) {
        applySessionPolicyToEditor(payload);
        setStatusMessage('Configuracoes atualizadas localmente (modo desenvolvimento).');
        return;
      }

      const response = await api.patchCompanySessionPolicy(
        session.access_token,
        session.tenant.id,
        payload
      );
      applySessionPolicyToEditor(response.session_policy ?? payload);
      setStatusMessage('Configuracoes de agentes salvas com sucesso.');
    } catch (error) {
      if (handleTokenAuthError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Falha ao salvar configuracoes.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshKnowledgeFiles = async (): Promise<void> => {
    if (!editableAgent.id) {
      setKnowledgeFiles([]);
      return;
    }

    await loadKnowledgeFilesForAgent(editableAgent.id);
  };

  const handleUploadKnowledgeFiles = async (selectedFiles: File[]): Promise<void> => {
    if (!session) {
      return;
    }

    clearMessages();

    if (!editableAgent.id) {
      setErrorMessage('Salve a aba Geral primeiro para criar o agente.');
      return;
    }
    if (isLocalDevSession(session)) {
      setStatusMessage(
        'Upload indisponível no modo desenvolvimento local sem backend. A UI segue acessível para testes.'
      );
      return;
    }

    const files = selectedFiles;
    if (files.length === 0) {
      setErrorMessage('Selecione ao menos um arquivo para upload.');
      return;
    }

    const agentId = editableAgent.id;
    setIsUploadingKnowledgeFiles(true);

    try {
      const results = await Promise.allSettled(
        files.map((file) =>
          api.uploadKnowledgeFile(session.access_token, {
            file,
            agentId,
            idempotencyKey: crypto.randomUUID()
          })
        )
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedResults = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      for (const failed of failedResults) {
        if (handleTokenAuthError(failed.reason)) {
          return;
        }
      }

      await loadKnowledgeFilesForAgent(agentId);

      if (successCount > 0) {
        setStatusMessage(`${successCount} arquivo(s) enviado(s) para a base de conhecimento.`);
      }

      if (failedResults.length > 0) {
        const firstReason = failedResults[0].reason;
        const message =
          firstReason instanceof Error ? firstReason.message : 'Falha ao enviar um ou mais arquivos.';
        setErrorMessage(message);
      }
    } catch (error) {
      if (handleTokenAuthError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Falha ao enviar arquivos.';
      setErrorMessage(message);
    } finally {
      setIsUploadingKnowledgeFiles(false);
    }
  };

  const handleDeleteAgent = async (): Promise<void> => {
    if (!session || !editableAgent.id) {
      return;
    }

    const shouldDelete = window.confirm('Deseja excluir este agente?');
    if (!shouldDelete) {
      return;
    }

    clearMessages();
    setIsSaving(true);

    try {
      if (isLocalDevSession(session)) {
        const remainingAgents = agents.filter((agent) => agent.id !== editableAgent.id);
        setAgents(remainingAgents);
        setKnowledgeFiles([]);

        if (remainingAgents.length > 0) {
          setSelectedAgentId(remainingAgents[0].id);
          setEditableAgent(mapApiAgentToEditable(remainingAgents[0]));
        } else {
          setSelectedAgentId(null);
          setEditableAgent(createEmptyAgent());
        }

        setStatusMessage('Agente excluído localmente (modo desenvolvimento).');
        return;
      }

      await api.deleteAgent(editableAgent.id, session.access_token);

      const remainingAgents = agents.filter((agent) => agent.id !== editableAgent.id);
      setAgents(remainingAgents);

      if (remainingAgents.length > 0) {
        setSelectedAgentId(remainingAgents[0].id);
        setEditableAgent(mapApiAgentToEditable(remainingAgents[0]));
      } else {
        setSelectedAgentId(null);
        setEditableAgent(createEmptyAgent());
      }

      setStatusMessage('Agente excluído com sucesso.');
    } catch (error) {
      if (handleTokenAuthError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Falha ao excluir agente.';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return (
      <LoginForm
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        authError={authError}
        isAuthenticating={isAuthenticating}
        onSubmit={handleLoginSubmit}
      />
    );
  }

  return (
    <>
      <div className="app-shell">
        <AgentsSidebar
          session={session}
          isLoadingAgents={isLoadingAgents}
          agents={agents}
          activeView={activeView}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
          onNewAgent={handleNewAgent}
          onOpenAgentsSettings={handleOpenAgentsSettings}
          onLogout={handleLogout}
        />

        <main className="content">
          <header className="content-header">
            <h1>{activeView === 'agents' ? 'Gerenciamento de Agentes' : 'Configuracoes de Agentes'}</h1>
            <p>
              {activeView === 'agents'
                ? editableAgent.id
                  ? `agent_id: ${editableAgent.id}`
                  : 'Novo agente nao salvo'
                : 'Classificacoes de triagem e roteamento inicial da jornada'}
            </p>
          </header>

          {statusMessage ? <p className="message success">{statusMessage}</p> : null}
          {errorMessage ? <p className="message error">{errorMessage}</p> : null}

          {activeView === 'agents' ? (
            <>
              <AgentTabs activeTab={activeTab} onTabChange={setActiveTab} />

              {activeTab === 'geral' ? (
                <GeralTab
                  editableAgent={editableAgent}
                  setEditableAgent={setEditableAgent}
                  isSaving={isSaving}
                  onSave={handleSaveGeral}
                  onDelete={handleDeleteAgent}
                  defaultChatwootUrl={DEFAULT_CHATWOOT_URL}
                />
              ) : null}

              {activeTab === 'inteligencia' ? (
                <InteligenciaTab
                  editableAgent={editableAgent}
                  setEditableAgent={setEditableAgent}
                  knowledgeFiles={knowledgeFiles}
                  isLoadingKnowledgeFiles={isLoadingKnowledgeFiles}
                  isUploadingKnowledgeFiles={isUploadingKnowledgeFiles}
                  isSaving={isSaving}
                  onRefreshKnowledgeFiles={handleRefreshKnowledgeFiles}
                  onUploadKnowledgeFiles={handleUploadKnowledgeFiles}
                  onSave={handleSaveIntelligence}
                />
              ) : null}

              {activeTab === 'monitoramento' ? <MonitoramentoTab editableAgent={editableAgent} /> : null}
            </>
          ) : (
            <AgentsSettingsView
              agents={agents}
              routes={sessionPolicyRoutes}
              defaultInitialAgentId={defaultInitialAgentId}
              isLoading={isLoadingSessionPolicy}
              isSaving={isSaving}
              onAddRoute={handleAddSessionPolicyRoute}
              onRemoveRoute={handleRemoveSessionPolicyRoute}
              onRouteChange={handleSessionPolicyRouteChange}
              onDefaultInitialAgentChange={setDefaultInitialAgentId}
              onSave={handleSaveSessionPolicy}
            />
          )}
        </main>
      </div>

      {isReauthModalOpen ? (
        <div className="auth-modal-overlay" role="presentation">
          <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
            <h2 id="reauth-title">Sessão expirada</h2>
            <p className="auth-modal-subtitle">
              Seu token expirou. Faça login novamente para continuar sem perder o contexto.
            </p>

            <form className="auth-modal-form" onSubmit={handleReauthSubmit}>
              <label className="field-label" htmlFor="reauth-email">
                email
              </label>
              <input
                id="reauth-email"
                type="email"
                value={reauthForm.email}
                onChange={(event) =>
                  setReauthForm((current) => ({
                    ...current,
                    email: event.target.value
                  }))
                }
                required
              />

              <label className="field-label" htmlFor="reauth-password">
                password
              </label>
              <input
                id="reauth-password"
                type="password"
                value={reauthForm.password}
                onChange={(event) =>
                  setReauthForm((current) => ({
                    ...current,
                    password: event.target.value
                  }))
                }
                required
              />

              <div className="auth-modal-actions">
                <button className="ghost-button" type="button" onClick={handleLogout}>
                  Sair
                </button>
                <button className="primary-button" type="submit" disabled={isReauthenticating}>
                  {isReauthenticating ? 'Entrando...' : 'Renovar sessão'}
                </button>
              </div>

              {reauthError ? <p className="message error">{reauthError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;
