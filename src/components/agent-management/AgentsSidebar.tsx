import type { ApiAgent, AuthSession } from '../../types';

interface AgentsSidebarProps {
  session: AuthSession;
  isLoadingAgents: boolean;
  agents: ApiAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onNewAgent: () => void;
  onLogout: () => void;
}

export function AgentsSidebar({
  session,
  isLoadingAgents,
  agents,
  selectedAgentId,
  onSelectAgent,
  onNewAgent,
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
        <button className="sidebar-add-button" type="button" onClick={onNewAgent}>
          Novo agente
        </button>
      </div>

      <div className="sidebar-body">
        {isLoadingAgents ? <p className="sidebar-state">Carregando agentes...</p> : null}

        {!isLoadingAgents && agents.length === 0 ? (
          <p className="sidebar-state">Nenhum agente encontrado.</p>
        ) : null}

        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={selectedAgentId === agent.id ? 'agent-item selected' : 'agent-item'}
            onClick={() => onSelectAgent(agent.id)}
          >
            <span className="agent-name">{agent.name || agent.id}</span>
            <span className="agent-kind">{agent.kind}</span>
          </button>
        ))}
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
