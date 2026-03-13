import type { ApiAgent, AuthSession } from '../../types';

interface AgentsSidebarProps {
  session: AuthSession;
  isLoadingAgents: boolean;
  agents: ApiAgent[];
  activeView: 'agents' | 'settings-agents';
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
  onOpenAgentsSettings: () => void;
  onLogout: () => void;
}

export function AgentsSidebar({
  session,
  isLoadingAgents,
  agents,
  activeView,
  selectedAgentId,
  onSelectAgent,
  onNewAgent,
  onOpenAgentsSettings,
  onLogout
}: AgentsSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>Northway Hub</span>
        </div>
      </div>

      <div className="sidebar-body">
        <section className="sidebar-section">
          <div className="sidebar-section-header">
            <p className="sidebar-section-title">Agentes</p>
            <button className="sidebar-add-button" type="button" onClick={onNewAgent}>
              Novo
            </button>
          </div>

          {isLoadingAgents ? <p className="sidebar-state">Carregando agentes...</p> : null}

          {!isLoadingAgents && agents.length === 0 ? (
            <p className="sidebar-state">Nenhum agente encontrado.</p>
          ) : null}

          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={
                activeView === 'agents' && selectedAgentId === agent.id
                  ? 'agent-item selected'
                  : 'agent-item'
              }
              onClick={() => onSelectAgent(agent.id)}
            >
              <span className="agent-name">{agent.name || agent.id}</span>
              <span className="agent-kind">{agent.kind}</span>
            </button>
          ))}
        </section>

        <section className="sidebar-section">
          <p className="sidebar-section-title">Configuracoes</p>
          <button
            type="button"
            className={activeView === 'settings-agents' ? 'sidebar-nav-item selected' : 'sidebar-nav-item'}
            onClick={onOpenAgentsSettings}
          >
            Agentes
          </button>
        </section>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{session.user.email}</strong>
          <small>{session.tenant.name}</small>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Sair
        </button>
      </div>
    </aside>
  );
}
