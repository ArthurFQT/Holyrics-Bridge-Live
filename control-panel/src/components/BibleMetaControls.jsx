import { BIBLE_META_POSITIONS } from "../constants/channels";
import { CheckboxField, NumberField, SelectField } from "./fields";

const BibleMetaControls = ({ currentStyle, onStyleChange }) => (
  <div className="style-section field-full">
    <div className="style-section-title">Versão e referência bíblica</div>

    <CheckboxField
      label="Mostrar versao da Biblia"
      inline
      checked={currentStyle.showBibleVersion}
      onChange={(event) => onStyleChange("showBibleVersion", event.target.checked)}
    />

    <SelectField
      label="Posicao da versao"
      value={currentStyle.bibleVersionPosition}
      disabled={!currentStyle.showBibleVersion}
      onChange={(event) => onStyleChange("bibleVersionPosition", event.target.value)}
    >
      {BIBLE_META_POSITIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>

    <NumberField
      label="Tamanho da versao (px)"
      min={14}
      max={120}
      value={currentStyle.bibleVersionFontSize}
      disabled={!currentStyle.showBibleVersion}
      onChange={(event) => onStyleChange("bibleVersionFontSize", event.target.value)}
    />

    <CheckboxField
      label="Mostrar livro/capitulo/versiculo"
      inline
      checked={currentStyle.showBibleReference}
      onChange={(event) => onStyleChange("showBibleReference", event.target.checked)}
    />

    <SelectField
      label="Posicao da referencia"
      value={currentStyle.bibleReferencePosition}
      disabled={!currentStyle.showBibleReference}
      onChange={(event) => onStyleChange("bibleReferencePosition", event.target.value)}
    >
      {BIBLE_META_POSITIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>

    <NumberField
      label="Tamanho da referencia (px)"
      min={16}
      max={140}
      value={currentStyle.bibleReferenceFontSize}
      disabled={!currentStyle.showBibleReference}
      onChange={(event) => onStyleChange("bibleReferenceFontSize", event.target.value)}
    />
  </div>
);

export default BibleMetaControls;
