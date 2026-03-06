export type AgentTab = 'geral' | 'inteligencia' | 'monitoramento';

interface AgentTabsProps {
  activeTab: AgentTab;
  onTabChange: (tab: AgentTab) => void;
}

export function AgentTabs({ activeTab, onTabChange }: AgentTabsProps) {
  return (
    <nav className="tabs" aria-label="Agent tabs">
      <button
        type="button"
        className={activeTab === 'geral' ? 'tab active' : 'tab'}
        onClick={() => onTabChange('geral')}
      >
        Geral
      </button>
      <button
        type="button"
        className={activeTab === 'inteligencia' ? 'tab active' : 'tab'}
        onClick={() => onTabChange('inteligencia')}
      >
        Inteligência
      </button>
      <button
        type="button"
        className={activeTab === 'monitoramento' ? 'tab active' : 'tab'}
        onClick={() => onTabChange('monitoramento')}
      >
        Monitoramento
      </button>
    </nav>
  );
}
