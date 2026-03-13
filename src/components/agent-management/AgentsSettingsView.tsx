import type { ApiAgent, EditableSessionPolicyRoute } from '../../types';

interface AgentsSettingsViewProps {
  agents: ApiAgent[];
  routes: EditableSessionPolicyRoute[];
  defaultInitialAgentId: string;
  isLoading: boolean;
  isSaving: boolean;
  onAddRoute: () => void;
  onRemoveRoute: (routeId: string) => void;
  onRouteChange: (
    routeId: string,
    field: keyof Pick<EditableSessionPolicyRoute, 'classification' | 'agent_id'>,
    value: string
  ) => void;
  onDefaultInitialAgentChange: (agentId: string) => void;
  onSave: () => void;
}

export function AgentsSettingsView({
  agents,
  routes,
  defaultInitialAgentId,
  isLoading,
  isSaving,
  onAddRoute,
  onRemoveRoute,
  onRouteChange,
  onDefaultInitialAgentChange,
  onSave
}: AgentsSettingsViewProps) {
  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="settings-panel-header">
          <div>
            <h2 className="panel-title">Classificacoes de triagem</h2>
            <p className="panel-description">
              Relacione cada classificacao de triagem ao agente especialista que deve assumir a conversa.
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onAddRoute}>
            + Adicionar
          </button>
        </div>

        {isLoading ? <p className="settings-state">Carregando configuracoes...</p> : null}

        {!isLoading && routes.length === 0 ? (
          <p className="settings-state">Nenhuma classificacao configurada.</p>
        ) : null}

        {!isLoading ? (
          <div className="session-policy-list">
            {routes.map((route, index) => (
              <div className="session-policy-row" key={route.id}>
                <div>
                  <label className="field-label" htmlFor={`classification-${route.id}`}>
                    Classificacao {index + 1}
                  </label>
                  <input
                    id={`classification-${route.id}`}
                    type="text"
                    value={route.classification}
                    placeholder="billing"
                    onChange={(event) => onRouteChange(route.id, 'classification', event.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor={`agent-${route.id}`}>
                    Agente
                  </label>
                  <select
                    id={`agent-${route.id}`}
                    value={route.agent_id}
                    onChange={(event) => onRouteChange(route.id, 'agent_id', event.target.value)}
                  >
                    <option value="">Selecione um agente</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="session-policy-row-actions">
                  <label className="field-label session-policy-row-action-label" htmlFor={`remove-${route.id}`}>
                    Remover
                  </label>
                  <button
                    id={`remove-${route.id}`}
                    className="icon-button"
                    type="button"
                    aria-label={`Remover classificacao ${index + 1}`}
                    onClick={() => onRemoveRoute(route.id)}
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Agente inicial</h2>
        <p className="panel-description">
          Escolha o agente padrao que deve iniciar a jornada quando a primeira mensagem do cliente chegar.
        </p>

        <div className="settings-single-field">
          <div>
            <label className="field-label" htmlFor="default-initial-agent">
              Agente padrao
            </label>
            <select
              id="default-initial-agent"
              value={defaultInitialAgentId}
              onChange={(event) => onDefaultInitialAgentChange(event.target.value)}
            >
              <option value="">Selecione um agente</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="action-row">
        <button type="button" onClick={onSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Salvando...' : 'Salvar configuracoes'}
        </button>
      </div>
    </div>
  );
}
