const formatTimestamp = (value) => {
  if (!value) {
    return "-";
  }

  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return value;
  }
};

const HolyricsDiagnostics = ({ diagnostics, onRefresh, onResetDefaults }) => (
  <section className="glass-card compact">
    <h2>Diagnostico Holyrics</h2>
    <p className="subtitle">Estado da ultima leitura da API do Holyrics.</p>

    <div className="diagnostics-grid">
      <div className="diagnostics-item">
        <span className="diagnostics-label">Ultima tentativa</span>
        <span>{formatTimestamp(diagnostics.lastAttemptAt)}</span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">Ultimo sucesso</span>
        <span>{formatTimestamp(diagnostics.lastSuccessAt)}</span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">Ultimo erro</span>
        <span className={diagnostics.lastError ? "diagnostics-error" : ""}>
          {diagnostics.lastError || "Nenhum"}
        </span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">URL consultada</span>
        <span>{diagnostics.lastUrl || "-"}</span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">Tipo detectado</span>
        <span>{diagnostics.lastType || "-"}</span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">Canal resolvido</span>
        <span>{diagnostics.lastChannel || "-"}</span>
      </div>

      <div className="diagnostics-item">
        <span className="diagnostics-label">Tamanho do texto</span>
        <span>{diagnostics.lastTextLength ?? 0} caracteres</span>
      </div>
    </div>

    {diagnostics.lastResponsePreview ? (
      <div className="diagnostics-preview">
        <span className="diagnostics-label">Preview da resposta bruta</span>
        <pre>{diagnostics.lastResponsePreview}</pre>
      </div>
    ) : null}

    <div className="field field-full action-row">
      <button type="button" className="ghost" onClick={onRefresh}>
        Atualizar diagnostico
      </button>
      <button type="button" className="ghost quiet" onClick={onResetDefaults}>
        Restaurar configuracao padrao
      </button>
    </div>
  </section>
);

export default HolyricsDiagnostics;
