const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const CHANNELS = {
  DEFAULT: "default",
  MUSIC: "music",
  BIBLE: "bible",
};

const validChannels = new Set(Object.values(CHANNELS));

const defaultStyle = {
  color: "#ffffff",
  fontSize: 72,
  fontFamily: '"Manrope", "Segoe UI", sans-serif',
  fontImportUrl: "",
  textAlign: "center",
  shadowEnabled: true,
  shadowIntensity: 65,
  backgroundMode: "transparent",
  backgroundTransparent: true,
  backgroundColor: "#000000",
  gradientColor: "#000000",
  gradientOpacity: 78,
  gradientSpread: 68,
  gradientDirection: "to top right",
  showBibleVersion: true,
  showBibleReference: true,
  bibleVersionPosition: "top-right",
  bibleReferencePosition: "bottom-right",
  bibleVersionFontSize: 32,
  bibleReferenceFontSize: 40,
  fade: false,
  visible: true,
};

const validBackgroundModes = new Set(["transparent", "solid", "gradient"]);
const validBibleMetaPositions = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const validGradientDirections = new Set([
  "to top",
  "to right",
  "to left",
  "to bottom",
  "to top right",
  "to top left",
  "to bottom right",
  "to bottom left",
]);

const normalizeHexColor = (value, fallback = "#000000") => {
  const color = String(value || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
};

const hexToRgb = (hexColor) => {
  const hex = normalizeHexColor(hexColor).replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : hex;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

export const getSafeChannel = (channel) => {
  const normalized = String(channel || "").toLowerCase();
  return validChannels.has(normalized) ? normalized : CHANNELS.DEFAULT;
};

// Usado so por `createInitialChannelStates` abaixo - nao precisa ser
// exportado, mais nenhum outro modulo cria um unico canal isolado.
const createInitialState = () => ({
  texto: "",
  // Texto "cru", antes de qualquer transformacao de layout (ex: agrupamento
  // de linhas da musica). E a partir dele que o layout e recalculado quando
  // a configuracao muda - `texto` sempre pode ser derivado de novo a partir
  // de `textoOriginal`, o inverso nao e verdade.
  textoOriginal: "",
  estilo: buildRenderStyle(defaultStyle),
  bibleInfo: {
    version: "",
    reference: "",
  },
  type: "",
  updatedAt: new Date().toISOString(),
  source: "system",
});

export const createInitialChannelStates = () => ({
  [CHANNELS.DEFAULT]: createInitialState(),
  [CHANNELS.MUSIC]: createInitialState(),
  [CHANNELS.BIBLE]: createInitialState(),
});

export const buildRenderStyle = (styleInput = {}) => {
  const merged = {
    ...defaultStyle,
    ...(styleInput || {}),
  };

  const fontSize = clamp(Number(merged.fontSize) || defaultStyle.fontSize, 16, 220);
  const shadowIntensity = clamp(Number(merged.shadowIntensity) || 0, 0, 100);
  const shadowEnabled = Boolean(merged.shadowEnabled);

  const shadowAlpha = (0.2 + shadowIntensity / 140).toFixed(2);
  const shadowBlur = Math.round((shadowIntensity / 100) * 12);
  const textShadow = shadowEnabled
    ? `0px 2px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha}), 0px 0px 2px rgba(0, 0, 0, 0.45)`
    : "none";

  const backgroundMode = validBackgroundModes.has(String(merged.backgroundMode || "").toLowerCase())
    ? String(merged.backgroundMode).toLowerCase()
    : merged.backgroundTransparent
      ? "transparent"
      : "solid";

  const backgroundColor = normalizeHexColor(merged.backgroundColor, defaultStyle.backgroundColor);
  const gradientColor = normalizeHexColor(merged.gradientColor, backgroundColor);
  const gradientOpacity = clamp(Number(merged.gradientOpacity) || 0, 0, 100);
  const gradientSpread = clamp(Number(merged.gradientSpread) || 0, 15, 100);
  const gradientDirection = validGradientDirections.has(
    String(merged.gradientDirection || "").toLowerCase()
  )
    ? String(merged.gradientDirection).toLowerCase()
    : defaultStyle.gradientDirection;
  const bibleVersionPosition = validBibleMetaPositions.has(
    String(merged.bibleVersionPosition || "").toLowerCase()
  )
    ? String(merged.bibleVersionPosition).toLowerCase()
    : defaultStyle.bibleVersionPosition;
  const bibleReferencePosition = validBibleMetaPositions.has(
    String(merged.bibleReferencePosition || "").toLowerCase()
  )
    ? String(merged.bibleReferencePosition).toLowerCase()
    : defaultStyle.bibleReferencePosition;
  const bibleVersionFontSize = clamp(
    Number(merged.bibleVersionFontSize) || defaultStyle.bibleVersionFontSize,
    14,
    120
  );
  const bibleReferenceFontSize = clamp(
    Number(merged.bibleReferenceFontSize) || defaultStyle.bibleReferenceFontSize,
    16,
    140
  );

  const rgb = hexToRgb(gradientColor);
  const gradientStart = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(gradientOpacity / 100).toFixed(2)})`;
  const gradientEnd = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;

  const renderBackground =
    backgroundMode === "transparent"
      ? "transparent"
      : backgroundMode === "solid"
        ? backgroundColor
        : `linear-gradient(${gradientDirection}, ${gradientStart} 0%, ${gradientEnd} ${gradientSpread}%)`;

  const fontFamily =
    typeof merged.fontFamily === "string" && merged.fontFamily.trim()
      ? merged.fontFamily.trim()
      : defaultStyle.fontFamily;

  return {
    color: String(merged.color || defaultStyle.color),
    fontSize,
    fontFamily,
    fontImportUrl: typeof merged.fontImportUrl === "string" ? merged.fontImportUrl.trim() : "",
    textAlign: ["left", "center", "right", "justify"].includes(merged.textAlign)
      ? merged.textAlign
      : defaultStyle.textAlign,
    shadowEnabled,
    shadowIntensity,
    textShadow,
    backgroundMode,
    backgroundTransparent: backgroundMode === "transparent",
    backgroundColor,
    gradientColor,
    gradientOpacity,
    gradientSpread,
    gradientDirection,
    showBibleVersion: merged.showBibleVersion !== false,
    showBibleReference: merged.showBibleReference !== false,
    bibleVersionPosition,
    bibleReferencePosition,
    bibleVersionFontSize,
    bibleReferenceFontSize,
    renderBackground,
    fade: Boolean(merged.fade),
    visible: merged.visible !== false,
  };
};

const sanitizeBibleInfo = (input = {}) => ({
  version: typeof input?.version === "string" ? input.version.trim() : "",
  reference: typeof input?.reference === "string" ? input.reference.trim() : "",
});

const sanitizeType = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.replace(/\r\n/g, "\n").trimEnd();
};

export const mergeState = (currentState, input = {}) => {
  const incomingText = normalizeText(input.texto, currentState.texto);

  // Se quem chamou passou `textoOriginal` explicitamente, usa isso. Senao,
  // se passou `texto` (mesmo sem textoOriginal), assume que o texto bruto e
  // o mesmo (cobre canais sem transformacao, tipo bible/default). Se nao
  // passou nem um nem outro (ex: update so de estilo), mantem o valor atual.
  const incomingTextoOriginal = normalizeText(
    input.textoOriginal !== undefined ? input.textoOriginal : input.texto,
    currentState.textoOriginal
  );

  const incomingStyle = buildRenderStyle({
    ...currentState.estilo,
    ...(input.estilo || {}),
  });
  const textChanged = incomingText !== currentState.texto;

  let incomingBibleInfo = currentState.bibleInfo || {
    version: "",
    reference: "",
  };

  if (input.bibleInfo === null) {
    incomingBibleInfo = { version: "", reference: "" };
  } else if (input.bibleInfo !== undefined) {
    incomingBibleInfo = sanitizeBibleInfo(input.bibleInfo);
  } else if (textChanged) {
    incomingBibleInfo = { version: "", reference: "" };
  }

  let incomingType = currentState.type || "";

  if (input.type === null) {
    incomingType = "";
  } else if (input.type !== undefined) {
    incomingType = sanitizeType(input.type);
  } else if (textChanged) {
    incomingType = "";
  }

  const nextState = {
    texto: incomingText,
    textoOriginal: incomingTextoOriginal,
    estilo: incomingStyle,
    bibleInfo: incomingBibleInfo,
    type: incomingType,
    updatedAt: new Date().toISOString(),
    source: input.source || "manual",
  };

  const changed =
    currentState.texto !== nextState.texto ||
    currentState.textoOriginal !== nextState.textoOriginal ||
    (currentState.type || "") !== nextState.type ||
    JSON.stringify(currentState.bibleInfo || {}) !== JSON.stringify(nextState.bibleInfo || {}) ||
    JSON.stringify(currentState.estilo) !== JSON.stringify(nextState.estilo);

  return {
    changed,
    state: changed ? nextState : currentState,
  };
};

export const toClientPayload = (state, channel = CHANNELS.DEFAULT) => {
  const style = state.estilo;
  const renderBackgroundColor = style.backgroundTransparent ? "transparent" : style.backgroundColor;
  const bibleInfo = sanitizeBibleInfo(state.bibleInfo);

  return {
    texto: state.texto,
    estilo: {
      color: style.color,
      fontSize: `${style.fontSize}px`,
      textAlign: style.textAlign,
      textShadow: style.textShadow,
      fontFamily: style.fontFamily,
      fontImportUrl: style.fontImportUrl || "",
      shadowEnabled: style.shadowEnabled,
      shadowIntensity: style.shadowIntensity,
      backgroundMode: style.backgroundMode,
      backgroundTransparent: style.backgroundTransparent,
      backgroundColor: style.backgroundColor,
      gradientColor: style.gradientColor,
      gradientOpacity: style.gradientOpacity,
      gradientSpread: style.gradientSpread,
      gradientDirection: style.gradientDirection,
      showBibleVersion: style.showBibleVersion,
      showBibleReference: style.showBibleReference,
      bibleVersionPosition: style.bibleVersionPosition,
      bibleReferencePosition: style.bibleReferencePosition,
      bibleVersionFontSize: style.bibleVersionFontSize,
      bibleReferenceFontSize: style.bibleReferenceFontSize,
      renderBackground: style.renderBackground,
      renderBackgroundColor,
      fade: style.fade,
      visible: style.visible,
    },
    meta: {
      updatedAt: state.updatedAt,
      source: state.source,
      channel: getSafeChannel(channel),
      type: state.type || "",
      bibleInfo,
    },
  };
};

export const resolveHolyricsChannel = (holyricsType) => {
  const normalized = String(holyricsType || "").toUpperCase();

  // Holyrics costuma retornar "song"/"music" para musicas e "verse"/"bible"
  // (e variantes em PT) para versiculos.
  if (/MUSIC|SONG|M[UÚ]SICA/.test(normalized)) {
    return CHANNELS.MUSIC;
  }

  if (/BIBLE|VERSE|VERS[IÍ]CULO|B[IÍ]BLIA/.test(normalized)) {
    return CHANNELS.BIBLE;
  }

  return CHANNELS.DEFAULT;
};

export const sanitizeHolyricsConfig = (config) => ({
  host: String(config.host || "127.0.0.1"),
  port: Number(config.port) || 8080,
  path: String(config.path || "/view/text.json"),
  method: String(config.method || "GET").toUpperCase(),
  token: String(config.token || ""),
  tokenHeader: String(config.tokenHeader || "Authorization"),
  textPath: String(config.textPath || "map.text"),
  pullEnabled: Boolean(config.pullEnabled),
  pullIntervalMs: clamp(Number(config.pullIntervalMs) || 400, 100, 5000),
  timeoutMs: clamp(Number(config.timeoutMs) || 1500, 500, 6000),
});
