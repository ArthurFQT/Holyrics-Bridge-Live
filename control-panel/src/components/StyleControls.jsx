import { FONT_OPTIONS } from "../constants/fonts";
import {
  extractGoogleFontFamily,
  getCustomFontInputValue,
  getFontSelectValue,
  isLikelyGoogleFontsUrl,
} from "../utils/style";
import {
  CheckboxField,
  ColorField,
  NumberField,
  RangeField,
  SelectField,
  TextField,
} from "./fields";

const StyleControls = ({ currentStyle, onStyleChange }) => {
  const fontImportUrl = currentStyle.fontImportUrl || "";
  const detectedGoogleFont = extractGoogleFontFamily(fontImportUrl);
  const googleFontUrlLooksInvalid =
    fontImportUrl.trim().length > 0 && !isLikelyGoogleFontsUrl(fontImportUrl);

  return (
    <>
      <div className="style-section field-full">
        <div className="style-section-title">Texto e fonte</div>

        <ColorField
          label="Cor da fonte"
          value={currentStyle.color}
          onChange={(event) => onStyleChange("color", event.target.value)}
        />

        <NumberField
          label="Tamanho da fonte (px)"
          min={16}
          max={220}
          value={currentStyle.fontSize}
          onChange={(event) => onStyleChange("fontSize", event.target.value)}
        />

        <SelectField
          label="Fonte"
          value={getFontSelectValue(currentStyle.fontFamily)}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue === "custom") {
              return;
            }

            onStyleChange("fontFamily", nextValue);
          }}
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextField
          label="URL do Google Fonts (opcional)"
          fullWidth
          value={fontImportUrl}
          onChange={(event) => onStyleChange("fontImportUrl", event.target.value)}
          placeholder="Cole aqui a URL da aba 'Embed' do Google Fonts (ex: https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single&display=swap)"
        />

        {fontImportUrl.trim() ? (
          <p
            className={`field field-full font-import-hint ${googleFontUrlLooksInvalid ? "warning" : ""}`}
          >
            {googleFontUrlLooksInvalid
              ? "Essa URL nao parece ser do Google Fonts (deveria comecar com https://fonts.googleapis.com/). O nome da fonte abaixo nao foi preenchido automaticamente."
              : detectedGoogleFont
                ? `Fonte detectada automaticamente: "${detectedGoogleFont}". Ajuste o campo abaixo so se quiser trocar o nome ou o fallback.`
                : "Nao foi possivel identificar o nome da fonte nessa URL. Preencha o campo abaixo manualmente."}
          </p>
        ) : null}

        <TextField
          label="Nome da fonte (preenchido automaticamente pela URL acima)"
          fullWidth
          value={getCustomFontInputValue(currentStyle.fontFamily)}
          onChange={(event) => onStyleChange("fontFamily", event.target.value)}
          placeholder='Sem URL: digite manualmente, ex: "Poppins", sans-serif'
        />

        <SelectField
          label="Alinhamento"
          value={currentStyle.textAlign}
          onChange={(event) => onStyleChange("textAlign", event.target.value)}
        >
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
          <option value="justify">Justificado</option>
        </SelectField>

        <CheckboxField
          label="Sombra ativada"
          inline
          checked={currentStyle.shadowEnabled}
          onChange={(event) => onStyleChange("shadowEnabled", event.target.checked)}
        />

        <RangeField
          label={`Intensidade da sombra (${currentStyle.shadowIntensity})`}
          min={0}
          max={100}
          value={currentStyle.shadowIntensity}
          disabled={!currentStyle.shadowEnabled}
          onChange={(event) => onStyleChange("shadowIntensity", event.target.value)}
        />
      </div>

      <div className="style-section field-full">
        <div className="style-section-title">Background e aparência</div>

        <SelectField
          label="Tipo de background"
          value={currentStyle.backgroundMode}
          onChange={(event) => onStyleChange("backgroundMode", event.target.value)}
        >
          <option value="transparent">Transparente</option>
          <option value="solid">Cor solida</option>
          <option value="gradient">Gradiente</option>
        </SelectField>

        {currentStyle.backgroundMode === "solid" && (
          <ColorField
            label="Cor do background"
            value={currentStyle.backgroundColor}
            onChange={(event) => onStyleChange("backgroundColor", event.target.value)}
          />
        )}

        {currentStyle.backgroundMode === "gradient" && (
          <>
            <ColorField
              label="Cor base do gradiente"
              value={currentStyle.gradientColor}
              onChange={(event) => onStyleChange("gradientColor", event.target.value)}
            />

            <SelectField
              label="Direcao do gradiente"
              value={currentStyle.gradientDirection}
              onChange={(event) => onStyleChange("gradientDirection", event.target.value)}
            >
              <option value="to top right">Canto inferior esquerdo para topo direito</option>
              <option value="to top left">Canto inferior direito para topo esquerdo</option>
              <option value="to top">Baixo para cima</option>
              <option value="to right">Esquerda para direita</option>
              <option value="to left">Direita para esquerda</option>
              <option value="to bottom">Cima para baixo</option>
            </SelectField>

            <RangeField
              label={`Opacidade inicial (${currentStyle.gradientOpacity}%)`}
              min={0}
              max={100}
              value={currentStyle.gradientOpacity}
              onChange={(event) => onStyleChange("gradientOpacity", event.target.value)}
            />

            <RangeField
              label={`Alcance para transparencia (${currentStyle.gradientSpread}%)`}
              min={15}
              max={100}
              value={currentStyle.gradientSpread}
              onChange={(event) => onStyleChange("gradientSpread", event.target.value)}
            />
          </>
        )}

        <CheckboxField
          label="Fade suave na troca de letra"
          inline
          checked={currentStyle.fade}
          onChange={(event) => onStyleChange("fade", event.target.checked)}
        />
      </div>
    </>
  );
};

export default StyleControls;
