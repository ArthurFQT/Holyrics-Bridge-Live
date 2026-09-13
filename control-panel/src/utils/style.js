import { FONT_FALLBACKS, FONT_OPTIONS } from "../constants/fonts";
import { initialStyle } from "../constants/defaults";

export const parseServerStyle = (style = {}) => {
  const parsedBackgroundMode =
    style.backgroundMode || (style.backgroundTransparent ? "transparent" : "solid");

  return {
    ...initialStyle,
    ...style,
    backgroundMode: parsedBackgroundMode,
    fontSize:
      Number(String(style.fontSize || initialStyle.fontSize).replace("px", "")) ||
      initialStyle.fontSize,
    bibleVersionFontSize:
      Number(
        String(style.bibleVersionFontSize || initialStyle.bibleVersionFontSize).replace("px", "")
      ) || initialStyle.bibleVersionFontSize,
    bibleReferenceFontSize:
      Number(
        String(style.bibleReferenceFontSize || initialStyle.bibleReferenceFontSize).replace(
          "px",
          ""
        )
      ) || initialStyle.bibleReferenceFontSize,
    shadowEnabled: style.shadowEnabled ?? style.textShadow !== "none",
  };
};

export const normalizeFontFamilySelection = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  if (FONT_OPTIONS.some((option) => option.value === selected)) {
    return selected;
  }

  if (FONT_FALLBACKS[selected]) {
    return FONT_FALLBACKS[selected];
  }

  return selected || initialStyle.fontFamily;
};

export const buildStylePayload = (style) => ({
  color: style.color,
  fontSize: Number(style.fontSize),
  fontFamily: normalizeFontFamilySelection(style.fontFamily),
  fontImportUrl: String(style.fontImportUrl || "").trim(),
  textAlign: style.textAlign,
  shadowEnabled: style.shadowEnabled,
  shadowIntensity: Number(style.shadowIntensity),
  backgroundMode: style.backgroundMode,
  backgroundTransparent: style.backgroundMode === "transparent",
  backgroundColor: style.backgroundColor,
  gradientColor: style.gradientColor,
  gradientOpacity: Number(style.gradientOpacity),
  gradientSpread: Number(style.gradientSpread),
  gradientDirection: style.gradientDirection,
  showBibleVersion: Boolean(style.showBibleVersion),
  showBibleReference: Boolean(style.showBibleReference),
  bibleVersionPosition: style.bibleVersionPosition,
  bibleReferencePosition: style.bibleReferencePosition,
  bibleVersionFontSize: Number(style.bibleVersionFontSize),
  bibleReferenceFontSize: Number(style.bibleReferenceFontSize),
  fade: style.fade,
  visible: style.visible !== false,
});

export const toPreviewMetaClass = (position = "top-right") => {
  const normalized = String(position || "").toLowerCase();
  if (
    [
      "top-left",
      "top-center",
      "top-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ].includes(normalized)
  ) {
    return `preview-${normalized}`;
  }

  return "preview-top-right";
};

export const getFontSelectValue = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  return FONT_OPTIONS.some((option) => option.value === selected) ? selected : "custom";
};

export const getCustomFontInputValue = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  return FONT_OPTIONS.some((option) => option.value === selected) ? "" : selected;
};

export const ensureGoogleFontImport = (url) => {
  if (typeof document === "undefined" || !url) {
    return;
  }

  const trimmedUrl = String(url).trim();
  if (!trimmedUrl) {
    return;
  }

  let link = document.querySelector(`link[data-google-font-import="${trimmedUrl}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = trimmedUrl;
    link.setAttribute("data-google-font-import", trimmedUrl);
    document.head.appendChild(link);
  }
};

export const buildPreviewBackground = (style) => {
  if (style.backgroundMode === "solid") {
    return style.backgroundColor;
  }

  if (style.backgroundMode === "gradient") {
    return `linear-gradient(${style.gradientDirection}, ${style.gradientColor} 0%, transparent ${style.gradientSpread}%)`;
  }

  return "linear-gradient(140deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 100%)";
};

export const joinFieldClasses = (...classes) => classes.filter(Boolean).join(" ");

export const isBottomPosition = (position) =>
  String(position || "")
    .toLowerCase()
    .startsWith("bottom");

export const isTopPosition = (position) =>
  String(position || "")
    .toLowerCase()
    .startsWith("top");
