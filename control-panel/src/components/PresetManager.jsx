import { useRef, useState } from "react";

import { TextField } from "./fields";

const PresetRow = ({ preset, onRename, onApply, onDelete }) => {
  const [name, setName] = useState(preset.name);
  const nameChanged = name.trim() && name.trim() !== preset.name;

  return (
    <li className="preset-row">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={`Nome do preset ${preset.name}`}
      />
      <div className="preset-row-actions">
        {nameChanged && (
          <button
            type="button"
            className="ghost quiet"
            onClick={() => onRename(preset.id, name.trim())}
          >
            Renomear
          </button>
        )}
        <button type="button" className="ghost" onClick={() => onApply(preset.id)}>
          Aplicar no canal atual
        </button>
        <button type="button" className="ghost quiet" onClick={() => onDelete(preset.id)}>
          Excluir
        </button>
      </div>
    </li>
  );
};

const PresetManager = ({
  presets,
  onSave,
  onRename,
  onApply,
  onDelete,
  onExport,
  onImportFile,
}) => {
  const [newPresetName, setNewPresetName] = useState("");
  const fileInputRef = useRef(null);

  const handleSave = (event) => {
    event.preventDefault();
    const trimmed = newPresetName.trim();
    if (!trimmed) {
      return;
    }
    onSave(trimmed);
    setNewPresetName("");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    event.target.value = "";
  };

  return (
    <section className="glass-card compact">
      <h2>Presets de estilo</h2>
      <p className="subtitle">Salve, aplique, exporte e importe estilos reutilizaveis.</p>

      <form onSubmit={handleSave} className="inline-form">
        <TextField
          label="Nome do novo preset"
          value={newPresetName}
          onChange={(event) => setNewPresetName(event.target.value)}
          placeholder="Ex: Louvor noturno"
        />
        <button type="submit" disabled={!newPresetName.trim()}>
          Salvar estilo atual como preset
        </button>
      </form>

      {presets.length > 0 ? (
        <ul className="preset-list">
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              onRename={onRename}
              onApply={onApply}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : (
        <p className="subtitle">Nenhum preset salvo ainda.</p>
      )}

      <div className="field field-full action-row">
        <button type="button" className="ghost" onClick={onExport} disabled={presets.length === 0}>
          Exportar presets (JSON)
        </button>
        <button type="button" className="ghost" onClick={handleImportClick}>
          Importar presets (JSON)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </section>
  );
};

export default PresetManager;
