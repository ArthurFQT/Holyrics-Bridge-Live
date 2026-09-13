import { CheckboxField, NumberField, SelectField, TextField } from "./fields";

const HolyricsConfigForm = ({ holyricsConfig, onFieldChange, onSubmit, onPullNow }) => (
  <section className="glass-card compact">
    <h2>Integracao Holyrics</h2>
    <p className="subtitle">Configure IP, porta, token e modo de leitura da API.</p>

    <form onSubmit={onSubmit} className="editor-grid">
      <TextField
        label="IP / Host"
        value={holyricsConfig.host}
        onChange={(event) => onFieldChange("host", event.target.value)}
      />

      <NumberField
        label="Porta"
        value={holyricsConfig.port}
        onChange={(event) => onFieldChange("port", event.target.value)}
      />

      <TextField
        label="Path da API"
        fullWidth
        value={holyricsConfig.path}
        onChange={(event) => onFieldChange("path", event.target.value)}
      />

      <SelectField
        label="Metodo HTTP"
        value={holyricsConfig.method}
        onChange={(event) => onFieldChange("method", event.target.value)}
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
      </SelectField>

      <TextField
        label="Token"
        value={holyricsConfig.token}
        onChange={(event) => onFieldChange("token", event.target.value)}
      />

      <TextField
        label="Header do token"
        value={holyricsConfig.tokenHeader}
        onChange={(event) => onFieldChange("tokenHeader", event.target.value)}
        placeholder="Authorization"
      />

      <TextField
        label="Campo do texto (path)"
        value={holyricsConfig.textPath}
        onChange={(event) => onFieldChange("textPath", event.target.value)}
        placeholder="Ex: map.text"
      />

      <NumberField
        label="Intervalo do pull (ms)"
        min={100}
        max={5000}
        value={holyricsConfig.pullIntervalMs}
        onChange={(event) => onFieldChange("pullIntervalMs", event.target.value)}
      />

      <NumberField
        label="Timeout HTTP (ms)"
        min={500}
        max={6000}
        value={holyricsConfig.timeoutMs}
        onChange={(event) => onFieldChange("timeoutMs", event.target.value)}
      />

      <CheckboxField
        label="Ativar leitura automatica (pull)"
        inline
        fullWidth
        checked={holyricsConfig.pullEnabled}
        onChange={(event) => onFieldChange("pullEnabled", event.target.checked)}
      />

      <div className="field field-full action-row">
        <button type="submit">Salvar configuracao Holyrics</button>
        <button type="button" className="ghost" onClick={onPullNow}>
          Ler agora da API Holyrics
        </button>
      </div>
    </form>
  </section>
);

export default HolyricsConfigForm;
