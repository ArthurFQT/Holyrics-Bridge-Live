import { CHANNELS } from "./channels";

export const initialStyle = {
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

export const initialHolyricsConfig = {
  host: "127.0.0.1",
  port: 8080,
  path: "/view/text.json",
  method: "GET",
  token: "",
  tokenHeader: "Authorization",
  textPath: "map.text",
  pullEnabled: true,
  pullIntervalMs: 400,
  timeoutMs: 1500,
};

export const initialLayoutConfig = {
  music: {
    breakEveryLines: 0,
  },
};

export const createEmptyDraft = () => ({
  texto: "",
  style: { ...initialStyle },
  bibleInfo: {
    version: "",
    reference: "",
  },
  type: "",
});

export const createInitialDrafts = () =>
  CHANNELS.reduce((acc, channel) => {
    acc[channel.id] = createEmptyDraft();
    return acc;
  }, {});
