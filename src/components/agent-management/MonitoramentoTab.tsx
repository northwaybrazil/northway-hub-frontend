import type { EditableAgent } from '../../types';

interface MonitoramentoTabProps {
  editableAgent: EditableAgent;
}

export function MonitoramentoTab({ editableAgent }: MonitoramentoTabProps) {
  return (
    <div className="panel-stack">
      <section className="panel">
        <h3 className="panel-title">Monitoramento</h3>
        <div className="monitor-grid">
          <div>
            <span>id</span>
            <strong>{editableAgent.id ?? '-'}</strong>
          </div>
          <div>
            <span>company_id</span>
            <strong>{editableAgent.company_id ?? '-'}</strong>
          </div>
          <div>
            <span>kind</span>
            <strong>{editableAgent.kind}</strong>
          </div>
          <div>
            <span>created_at</span>
            <strong>{editableAgent.created_at ?? '-'}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
