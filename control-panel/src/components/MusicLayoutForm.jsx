import { SelectField } from "./fields";

const MusicLayoutForm = ({ layoutConfig, onBreakEveryLinesChange, onSubmit }) => (
  <section className="glass-card compact">
    <h2>Layout Musica</h2>
    <p className="subtitle">Agrupa a musica em blocos de linhas e junta cada bloco em uma linha.</p>

    <form onSubmit={onSubmit} className="inline-form">
      <SelectField
        label="Agrupar musica a cada"
        value={layoutConfig.music.breakEveryLines}
        onChange={(event) => onBreakEveryLinesChange(Number(event.target.value))}
      >
        <option value={0}>Desativado</option>
        <option value={2}>2 linhas</option>
        <option value={3}>3 linhas</option>
        <option value={4}>4 linhas</option>
        <option value={5}>5 linhas</option>
      </SelectField>

      <button type="submit">Salvar layout da musica</button>
    </form>
  </section>
);

export default MusicLayoutForm;
