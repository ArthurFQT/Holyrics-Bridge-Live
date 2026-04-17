const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const CHANNELS = {
  DEFAULT: "default",
  MUSIC: "music",
  BIBLE: "bible"
};

const validChannels = new Set(Object.values(CHANNELS));

const defaultStyle = {
  color: "#ffffff",
  fontSize: 72,
  fontFamily: "Arial, sans-serif",
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
  fade: false
};

const validBackgroundModes = new Set(["transparent", "solid", "gradient"]);
const validBibleMetaPositions = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
const validGradientDirections = new Set([
  "to top",
  "to right",
  "to left",
  "to bottom",
  "to top right",
  "to top left",
  "to bottom right",
  "to bottom left"
]);

const normalizeHexColor = (value, fallback = "#000000") => {
  const color = String(value || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
};

const hexToRgb = (hexColor) => {
  const hex = normalizeHexColor(hexColor).replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => `${c}${c}`).join("") : hex;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
};

export const getSafeChannel = (channel) => {
  const normalized = String(channel || "").toLowerCase();
  return validChannels.has(normalized) ? normalized : CHANNELS.DEFAULT;
};

export const createInitialState = () => ({
  texto: "",
  estilo: buildRenderStyle(defaultStyle),
  bibleInfo: {
    version: "",
    reference: ""
  },
  updatedAt: new Date().toISOString(),
  source: "system"
});

export const createInitialChannelStates = () => ({
  [CHANNELS.DEFAULT]: createInitialState(),
  [CHANNELS.MUSIC]: createInitialState(),
  [CHANNELS.BIBLE]: createInitialState()
});

export const buildRenderStyle = (styleInput = {}) => {
  const merged = {
    ...defaultStyle,
    ...(styleInput || {})
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
  const gradientDirection = validGradientDirections.has(String(merged.gradientDirection || "").toLowerCase())
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

  return {
    color: String(merged.color || defaultStyle.color),
    fontSize,
    fontFamily: String(merged.fontFamily || defaultStyle.fontFamily),
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
    fade: Boolean(merged.fade)
  };
};

const sanitizeBibleInfo = (input = {}) => ({
  version: typeof input?.version === "string" ? input.version.trim() : "",
  reference: typeof input?.reference === "string" ? input.reference.trim() : ""
});

const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.replace(/\r\n/g, "\n").trimEnd();
};

export const mergeState = (currentState, input = {}) => {
  const incomingText = normalizeText(input.texto, currentState.texto);
  const incomingStyle = buildRenderStyle({
    ...currentState.estilo,
    ...(input.estilo || {})
  });
  const textChanged = incomingText !== currentState.texto;

  let incomingBibleInfo = currentState.bibleInfo || { version: "", reference: "" };

  if (input.bibleInfo === null) {
    incomingBibleInfo = { version: "", reference: "" };
  } else if (input.bibleInfo !== undefined) {
    incomingBibleInfo = sanitizeBibleInfo(input.bibleInfo);
  } else if (textChanged) {
    incomingBibleInfo = { version: "", reference: "" };
  }

  const nextState = {
    texto: incomingText,
    estilo: incomingStyle,
    bibleInfo: incomingBibleInfo,
    updatedAt: new Date().toISOString(),
    source: input.source || "manual"
  };

  const changed =
    currentState.texto !== nextState.texto ||
    JSON.stringify(currentState.bibleInfo || {}) !== JSON.stringify(nextState.bibleInfo || {}) ||
    JSON.stringify(currentState.estilo) !== JSON.stringify(nextState.estilo);

  return {
    changed,
    state: changed ? nextState : currentState
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
      fade: style.fade
    },
    meta: {
      updatedAt: state.updatedAt,
      source: state.source,
      channel: getSafeChannel(channel),
      bibleInfo
    }
  };
};

export const resolveHolyricsChannel = (holyricsType) => {
  const normalized = String(holyricsType || "").toUpperCase();

  if (normalized.includes("MUSIC")) {
    return CHANNELS.MUSIC;
  }

  if (normalized.includes("BIBLE")) {
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
  timeoutMs: clamp(Number(config.timeoutMs) || 1500, 500, 6000)
});
