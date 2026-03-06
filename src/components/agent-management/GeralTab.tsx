import type { Dispatch, SetStateAction } from 'react';
import type { EditableAgent } from '../../types';

interface GeralTabProps {
  editableAgent: EditableAgent;
  setEditableAgent: Dispatch<SetStateAction<EditableAgent>>;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  defaultChatwootUrl: string;
}

export function GeralTab({
  editableAgent,
  setEditableAgent,
  isSaving,
  onSave,
  onDelete,
  defaultChatwootUrl
}: GeralTabProps) {
  const updateIntegrationConfig = (
    key: keyof EditableAgent['integration']['config'],
    value: string
  ): void => {
    setEditableAgent((current) => ({
      ...current,
      integration: {
        ...current.integration,
        config: {
          ...current.integration.config,
          [key]: value
        }
      }
    }));
  };

  return (
    <div className="panel-stack">
      <section className="panel">
        <h3 className="panel-title">Identidade do Agente</h3>
        <div className="grid-two">
          <div>
            <label className="field-label" htmlFor="name">
              name
            </label>
            <input
              id="name"
              value={editableAgent.name}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="name"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="description">
              description
            </label>
            <textarea
              id="description"
              value={editableAgent.description}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              placeholder="description"
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Conectividade & Lógica</h3>
        <div className="grid-two">
          <div>
            <label className="field-label" htmlFor="kind">
              kind
            </label>
            <select
              id="kind"
              value={editableAgent.kind}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  kind: event.target.value as EditableAgent['kind'],
                  use_case:
                    event.target.value === 'CONVERSATIONAL'
                      ? (current.use_case ?? 'SDR')
                      : undefined
                }))
              }
            >
              <option value="CONVERSATIONAL">CONVERSATIONAL</option>
              <option value="REPORT_GENERATOR">REPORT_GENERATOR</option>
            </select>
          </div>

          {editableAgent.kind === 'CONVERSATIONAL' ? (
            <div>
              <label className="field-label" htmlFor="use_case">
                use_case
              </label>
              <select
                id="use_case"
                value={editableAgent.use_case ?? 'SDR'}
                onChange={(event) =>
                  setEditableAgent((current) => ({
                    ...current,
                    use_case: event.target.value as NonNullable<EditableAgent['use_case']>
                  }))
                }
              >
                <option value="SDR">SDR</option>
                <option value="SUPPORT">SUPPORT</option>
              </select>
            </div>
          ) : null}
        </div>

        <h4 className="panel-subtitle">Chatwoot Integration</h4>
        <div className="grid-two">
          <div>
            <label className="field-label" htmlFor="integration-account-id">
              integration.config.account_id
            </label>
            <input
              id="integration-account-id"
              value={editableAgent.integration.config.account_id}
              onChange={(event) => updateIntegrationConfig('account_id', event.target.value)}
              placeholder="account_id"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="integration-access-token">
              integration.config.access_token
            </label>
            <input
              id="integration-access-token"
              type="password"
              value={editableAgent.integration.config.access_token}
              onChange={(event) => updateIntegrationConfig('access_token', event.target.value)}
              placeholder="access_token"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="integration-agent-token">
              integration.config.agent_token
            </label>
            <input
              id="integration-agent-token"
              type="password"
              value={editableAgent.integration.config.agent_token}
              onChange={(event) => updateIntegrationConfig('agent_token', event.target.value)}
              placeholder="agent_token"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="integration-chatwoot-url">
              integration.config.chatwoot_url
            </label>
            <input
              id="integration-chatwoot-url"
              value={editableAgent.integration.config.chatwoot_url}
              onChange={(event) => updateIntegrationConfig('chatwoot_url', event.target.value)}
              placeholder={defaultChatwootUrl}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Handoff Humano</h3>
        <div className="grid-two">
          <label className="inline-field" htmlFor="handoff-to-human">
            <input
              id="handoff-to-human"
              type="checkbox"
              checked={editableAgent.handoff_to_human}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  handoff_to_human: event.target.checked
                }))
              }
            />
            handoff_to_human
          </label>

          <label className="inline-field" htmlFor="close-on-handoff">
            <input
              id="close-on-handoff"
              type="checkbox"
              checked={editableAgent.close_on_handoff}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  close_on_handoff: event.target.checked
                }))
              }
            />
            close_on_handoff
          </label>

          <div>
            <label className="field-label" htmlFor="agent-cooldown">
              agent_cooldown_minutes
            </label>
            <input
              id="agent-cooldown"
              type="number"
              min={0}
              value={editableAgent.agent_cooldown_minutes}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  agent_cooldown_minutes: Math.max(0, Number(event.target.value) || 0)
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="panel action-row">
        <button type="button" onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </section>

      <section className="panel danger-zone">
        <h3 className="panel-title">Excluir agente</h3>
        <button type="button" onClick={() => void onDelete()} disabled={isSaving || !editableAgent.id}>
          Excluir agente
        </button>
      </section>
    </div>
  );
}
