import { CHANNELS } from "../constants/channels";
import BibleMetaControls from "./BibleMetaControls";
import { TextareaField } from "./fields";
import PreviewPane from "./PreviewPane";
import StyleControls from "./StyleControls";

const ChannelEditor = ({
  selectedChannel,
  currentDraft,
  currentStyle,
  onTextChange,
  onStyleChange,
  onSubmit,
  onSendStyleToAll,
  onApplyBiblePreset,
  onApplyMusicPreset,
  onClearChannel,
  onToggleVisible,
}) => (
  <section className="glass-card">
    <h2>Editor de Canal</h2>
    <p className="subtitle">
      Canal em edicao:{" "}
      <strong>{CHANNELS.find((channel) => channel.id === selectedChannel)?.label}</strong>
      {currentDraft.type ? (
        <span className="type-badge" title="Tipo retornado pelo Holyrics">
          {currentDraft.type}
        </span>
      ) : null}
    </p>

    <form onSubmit={onSubmit} className="editor-grid">
      <TextareaField
        label="Letra atual"
        fullWidth
        rows={7}
        value={currentDraft.texto}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Digite aqui a letra em multiplas linhas"
      />

      <StyleControls currentStyle={currentStyle} onStyleChange={onStyleChange} />

      {selectedChannel === "bible" && (
        <BibleMetaControls currentStyle={currentStyle} onStyleChange={onStyleChange} />
      )}

      <div className="field field-full action-row">
        <button type="submit">Salvar no canal atual</button>
        <button type="button" className="ghost" onClick={onSendStyleToAll}>
          Enviar estilo para todos
        </button>
        <button type="button" className="ghost" onClick={onApplyBiblePreset}>
          Preset Biblia
        </button>
        <button type="button" className="ghost" onClick={onApplyMusicPreset}>
          Preset Musica
        </button>
      </div>

      <div className="field field-full action-row action-row-live">
        <button type="button" className="ghost" onClick={onToggleVisible}>
          {currentStyle.visible === false ? "Exibir canal" : "Ocultar canal"}
        </button>
        <button type="button" className="ghost quiet" onClick={onClearChannel}>
          Limpar canal atual
        </button>
      </div>
    </form>

    <PreviewPane
      selectedChannel={selectedChannel}
      currentDraft={currentDraft}
      currentStyle={currentStyle}
    />
  </section>
);

export default ChannelEditor;
