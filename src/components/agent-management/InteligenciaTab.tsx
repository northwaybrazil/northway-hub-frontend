import type { Dispatch, SetStateAction } from 'react';
import type { EditableAgent, KnowledgeFile } from '../../types';

interface InteligenciaTabProps {
  editableAgent: EditableAgent;
  setEditableAgent: Dispatch<SetStateAction<EditableAgent>>;
  knowledgeFiles: KnowledgeFile[];
  isLoadingKnowledgeFiles: boolean;
  isUploadingKnowledgeFiles: boolean;
  isSaving: boolean;
  onRefreshKnowledgeFiles: () => Promise<void>;
  onUploadKnowledgeFiles: (files: File[]) => Promise<void>;
  onSave: () => Promise<void>;
}

const DEFAULT_MODEL_OPTIONS = [
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-4o-mini',
  'gpt-4o',
  'o4-mini'
];

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export function InteligenciaTab({
  editableAgent,
  setEditableAgent,
  knowledgeFiles,
  isLoadingKnowledgeFiles,
  isUploadingKnowledgeFiles,
  isSaving,
  onRefreshKnowledgeFiles,
  onUploadKnowledgeFiles,
  onSave
}: InteligenciaTabProps) {
  const modelOptions = Array.from(
    new Set(
      editableAgent.model && !DEFAULT_MODEL_OPTIONS.includes(editableAgent.model)
        ? [editableAgent.model, ...DEFAULT_MODEL_OPTIONS]
        : DEFAULT_MODEL_OPTIONS
    )
  );

  return (
    <div className="panel-stack">
      <section className="panel">
        <h3 className="panel-title">Comportamento</h3>
        <div className="grid-two intelligence-grid">
          <div>
            <label className="field-label" htmlFor="model">
              model
            </label>
            <select
              id="model"
              value={editableAgent.model}
              onChange={(event) =>
                setEditableAgent((current) => ({
                  ...current,
                  model: event.target.value
                }))
              }
            >
              <option value="">Selecione um modelo</option>
              {modelOptions.map((modelOption) => (
                <option key={modelOption} value={modelOption}>
                  {modelOption}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="system-prompt">
            system_prompt
          </label>
          <textarea
            id="system-prompt"
            value={editableAgent.system_prompt}
            onChange={(event) =>
              setEditableAgent((current) => ({
                ...current,
                system_prompt: event.target.value
              }))
            }
            placeholder="You are a helpful assistant."
            rows={8}
          />
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Base de Conhecimento</h3>

        {!editableAgent.id ? (
          <p className="knowledge-state">Salve a aba Geral para habilitar uploads.</p>
        ) : null}

        <div className="knowledge-upload-row">
          <label className="field-label knowledge-upload-label" htmlFor="knowledge-files-input">
            upload de arquivos
          </label>
          <input
            id="knowledge-files-input"
            type="file"
            multiple
            disabled={!editableAgent.id || isUploadingKnowledgeFiles}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              void onUploadKnowledgeFiles(files);
            }}
          />
          <button
            type="button"
            className="ghost-button"
            onClick={() => void onRefreshKnowledgeFiles()}
            disabled={!editableAgent.id || isLoadingKnowledgeFiles || isUploadingKnowledgeFiles}
          >
            {isLoadingKnowledgeFiles ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </div>

        {isUploadingKnowledgeFiles ? <p className="knowledge-state">Enviando arquivos...</p> : null}
        {isLoadingKnowledgeFiles ? <p className="knowledge-state">Carregando arquivos...</p> : null}

        {!isLoadingKnowledgeFiles && knowledgeFiles.length === 0 ? (
          <p className="knowledge-state">Nenhum arquivo enviado para este agente.</p>
        ) : null}

        {!isLoadingKnowledgeFiles && knowledgeFiles.length > 0 ? (
          <ul className="knowledge-file-list">
            {knowledgeFiles.map((file) => (
              <li key={file.id} className="knowledge-file-item">
                <p className="knowledge-file-name">{file.original_filename}</p>
                <p className="knowledge-file-meta">
                  status: {file.status} | tamanho: {formatBytes(file.size_bytes)} | criado em:{' '}
                  {new Date(file.created_at).toLocaleString('pt-BR')}
                </p>
                {file.error_message ? <p className="knowledge-file-error">{file.error_message}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel action-row">
        <button type="button" onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </section>
    </div>
  );
}
