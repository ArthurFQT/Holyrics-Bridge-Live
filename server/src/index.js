import "dotenv/config";
import { randomUUID } from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import {
  extractBibleInfo,
  normalizeBibleContent,
  sanitizeHolyricsText,
  startHolyricsPull,
} from "./holyricsClient.js";
import { discoverHolyricsHosts, resolveServerUrls } from "./network.js";
import { createRuntimeConfigStore, isPlainObject } from "./runtimeConfig.js";
import {
  buildRenderStyle,
  CHANNELS,
  createInitialChannelStates,
  getSafeChannel,
  mergeState,
  resolveHolyricsChannel,
  sanitizeHolyricsConfig,
  toClientPayload,
} from "./state.js";

const app = express();
const server = http.createServer(app);

// Envolve um handler async para que rejeicoes de Promise (ex: erro dentro
// de um `await`) cheguem no error handler do Express em vez de virarem uma
// unhandled rejection silenciosa que derruba a resposta HTTP sem nunca
// responder ao cliente.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const parsePanelOrigin = (value) => {
  const raw = String(value || "*").trim();
  if (!raw || raw === "*") {
    return "*";
  }

  const origins = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return "*";
  }

  return origins.length === 1 ? origins[0] : origins;
};

const io = new Server(server, {
  cors: {
    origin: parsePanelOrigin(process.env.PANEL_ORIGIN),
  },
  transports: ["websocket"],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimeConfigStore = createRuntimeConfigStore({
  filePath: path.resolve(__dirname, "../data/runtime-config.json"),
  backupPath: path.resolve(__dirname, "../data/runtime-config.backup.json"),
  version: 1,
});

let runtimeConfigStatus = { source: "defaults", warning: null };

let channelStates = createInitialChannelStates();
let holyricsRunner;
let lastHolyricsContentChannel = null;
let layoutConfig = {
  music: {
    breakEveryLines: 0,
  },
};
let presets = [];

const sanitizePresetName = (value, fallback = "Preset") => {
  const trimmed = typeof value === "string" ? value.trim().slice(0, 60) : "";
  return trimmed || fallback;
};

const sanitizePreset = (input, existing) => ({
  id: existing?.id || randomUUID(),
  name: sanitizePresetName(input?.name, existing?.name),
  style: buildRenderStyle({ ...(existing?.style || {}), ...(input?.style || {}) }),
  createdAt: existing?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const holyricsDiagnostics = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastUrl: null,
  lastTextLength: 0,
  lastResponsePreview: null,
  lastType: null,
  lastChannel: null,
};

// A integracao com o Holyrics e configurada inteiramente pelo painel (ver
// POST /holyrics/config) e persistida em runtime-config.json - nao ha mais
// leitura de HOLYRICS_* no .env, que so gerava confusao (editar o .env nao
// tinha efeito nenhum depois da primeira config salva pela interface, ja
// que o valor persistido sempre tinha prioridade). `sanitizeHolyricsConfig`
// ja fornece defaults sensatos para uma instalacao nova.
let holyricsConfig = sanitizeHolyricsConfig({});

const buildPersistedRuntimeConfig = () => ({
  savedAt: new Date().toISOString(),
  lastHolyricsContentChannel,
  styles: {
    [CHANNELS.DEFAULT]: channelStates[CHANNELS.DEFAULT]?.estilo || {},
    [CHANNELS.MUSIC]: channelStates[CHANNELS.MUSIC]?.estilo || {},
    [CHANNELS.BIBLE]: channelStates[CHANNELS.BIBLE]?.estilo || {},
  },
  layoutConfig,
  holyricsConfig,
  presets,
});

const applyPersistedRuntimeConfig = (persisted) => {
  if (!persisted || typeof persisted !== "object") {
    return;
  }

  if (persisted.layoutConfig && typeof persisted.layoutConfig === "object") {
    layoutConfig = sanitizeLayoutConfig({
      ...layoutConfig,
      ...persisted.layoutConfig,
    });
  }

  if (persisted.holyricsConfig && typeof persisted.holyricsConfig === "object") {
    holyricsConfig = sanitizeHolyricsConfig({
      ...holyricsConfig,
      ...persisted.holyricsConfig,
    });
  }

  const persistedStyles = persisted.styles;
  if (persistedStyles && typeof persistedStyles === "object") {
    let nextStates = channelStates;

    for (const channel of Object.values(CHANNELS)) {
      const persistedStyle = persistedStyles[channel];
      if (!persistedStyle || typeof persistedStyle !== "object") {
        continue;
      }

      const { state } = mergeState(nextStates[channel], {
        estilo: persistedStyle,
        source: "runtime-config:load",
      });

      nextStates = {
        ...nextStates,
        [channel]: state,
      };
    }

    channelStates = nextStates;
  }

  if (Array.isArray(persisted.presets)) {
    presets = persisted.presets
      .filter((item) => isPlainObject(item))
      .map((item) => sanitizePreset(item, item));
  }

  if (typeof persisted.lastHolyricsContentChannel === "string") {
    lastHolyricsContentChannel = getSafeChannel(persisted.lastHolyricsContentChannel);
  }
};

const clampMusicBreakLines = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 2) {
    return 0;
  }
  return Math.min(Math.max(Math.round(parsed), 2), 12);
};

const sanitizeLayoutConfig = (input) => ({
  music: {
    breakEveryLines: clampMusicBreakLines(input?.music?.breakEveryLines),
  },
});

const applyMusicLineBreak = (text, breakEveryLines) => {
  if (breakEveryLines < 2) {
    return text;
  }

  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return "";
  }

  const output = [];
  for (let index = 0; index < lines.length; index += breakEveryLines) {
    const chunk = lines.slice(index, index + breakEveryLines);
    output.push(chunk.join(" "));
  }

  return output.join("\n");
};

const transformTextByChannel = (text, channel) => {
  if (channel !== CHANNELS.MUSIC) {
    return text;
  }

  const breakEveryLines = layoutConfig.music.breakEveryLines;
  return applyMusicLineBreak(text, breakEveryLines);
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/display", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/display/index.html"));
});

app.get("/display/music", (_req, res) => {
  res.redirect("/display?channel=music");
});

app.get("/display/bible", (_req, res) => {
  res.redirect("/display?channel=bible");
});

const roomFor = (channel) => `channel:${getSafeChannel(channel)}`;

const emitState = (channel) => {
  const safeChannel = getSafeChannel(channel);
  const state = channelStates[safeChannel];
  io.to(roomFor(safeChannel)).emit("lyrics:update", toClientPayload(state, safeChannel));
};

const resolveBibleInfoForChannel = (channel, bibleInfo) => {
  if (channel !== CHANNELS.BIBLE) {
    return null;
  }

  return bibleInfo || undefined;
};

// `texto` aqui e sempre o texto BRUTO (antes de qualquer transformacao de
// layout) - a transformacao acontece uma unica vez, aqui dentro, e o
// resultado (`transformedText`) e o que vira `estado.texto`. O texto bruto
// em si e preservado como `textoOriginal` no state, para poder ser
// reprocessado do zero quando a configuracao de layout mudar (ver
// /layout/config mais abaixo). Nunca passe um texto ja transformado para
// `texto` aqui, ou ele sera transformado de novo (dobrando o agrupamento).
const applyUpdate = ({ texto, estilo, source, channel, bibleInfo, type }) => {
  const safeChannel = getSafeChannel(channel);
  // `texto === undefined` significa "update so de estilo" (ex: ocultar
  // canal, aplicar preset, enviar estilo para todos) - nesse caso o texto
  // atual do canal deve ser preservado, nunca transformado. Passar
  // `undefined` para `transformTextByChannel`/`applyMusicLineBreak` faria o
  // agrupamento de linhas da musica tratar isso como texto vazio e apagar a
  // letra atual do canal `music`.
  const transformedText =
    texto === undefined ? undefined : transformTextByChannel(texto, safeChannel);
  const currentState = channelStates[safeChannel];
  const { changed, state } = mergeState(currentState, {
    texto: transformedText,
    textoOriginal: texto,
    estilo,
    source,
    bibleInfo: resolveBibleInfoForChannel(safeChannel, bibleInfo),
    type,
  });
  channelStates = {
    ...channelStates,
    [safeChannel]: state,
  };

  if (changed) {
    emitState(safeChannel);
  }

  return {
    changed,
    channel: safeChannel,
    state,
  };
};

const mirrorToDefault = ({ texto, estilo, source, channel, bibleInfo, type }) => {
  if (channel === CHANNELS.DEFAULT) {
    return;
  }

  applyUpdate({
    texto,
    estilo,
    source: `${source}:default-mirror`,
    channel: CHANNELS.DEFAULT,
    bibleInfo: channel === CHANNELS.BIBLE ? bibleInfo : null,
    type,
  });
};

const applyUpdateMany = ({ texto, estilo, source, channels, bibleInfo, type }) => {
  const targetChannels = (channels || [CHANNELS.DEFAULT]).map(getSafeChannel);
  const uniqueChannels = [...new Set(targetChannels)];
  const results = [];

  for (const channel of uniqueChannels) {
    const result = applyUpdate({
      texto,
      estilo,
      source,
      channel,
      bibleInfo,
      type,
    });
    results.push(result);
    mirrorToDefault({ texto, estilo, source, channel, bibleInfo, type });
  }

  return results;
};

const resolveIncomingHolyricsChannel = ({ type, text }) => {
  const resolvedChannel = resolveHolyricsChannel(type);
  const isEmptyText = String(text || "").trim().length === 0;

  if (resolvedChannel === CHANNELS.DEFAULT && isEmptyText && lastHolyricsContentChannel) {
    return lastHolyricsContentChannel;
  }

  return resolvedChannel;
};

const restartHolyricsPull = () => {
  holyricsRunner?.stop();

  holyricsRunner = startHolyricsPull({
    config: holyricsConfig,
    onLyric: ({ text, type, bibleInfo, raw }) => {
      const holyricsChannel = resolveIncomingHolyricsChannel({ type, text });
      applyUpdate({
        texto: text,
        source: "holyrics-pull",
        channel: holyricsChannel,
        bibleInfo,
        type,
      });
      mirrorToDefault({
        texto: text,
        source: "holyrics-pull",
        channel: holyricsChannel,
        bibleInfo,
        type,
      });

      if (holyricsChannel !== CHANNELS.DEFAULT) {
        lastHolyricsContentChannel = holyricsChannel;
      }

      holyricsDiagnostics.lastSuccessAt = new Date().toISOString();
      holyricsDiagnostics.lastTextLength = text.length;
      holyricsDiagnostics.lastError = null;
      holyricsDiagnostics.lastType = type || null;
      holyricsDiagnostics.lastChannel = holyricsChannel;
      try {
        holyricsDiagnostics.lastResponsePreview = JSON.stringify(raw).slice(0, 400);
      } catch (_error) {
        holyricsDiagnostics.lastResponsePreview = "[unserializable_response]";
      }
    },
    onError: (error) => {
      holyricsDiagnostics.lastError = error?.message || "Erro desconhecido";
    },
    logger: console,
  });
};

// Restaura estilos, layout e configuracao do Holyrics para os valores
// padrao (os mesmos que o servidor usaria numa instalacao nova) e persiste
// esse estado - usado quando a configuracao salva esta corrompida/confusa e
// o operador so quer "comecar do zero" com um clique.
const resetRuntimeConfigToDefaults = async () => {
  channelStates = createInitialChannelStates();
  layoutConfig = sanitizeLayoutConfig({});
  holyricsConfig = sanitizeHolyricsConfig({});
  lastHolyricsContentChannel = null;

  restartHolyricsPull();

  for (const channel of Object.values(CHANNELS)) {
    emitState(channel);
  }

  await runtimeConfigStore.saveNow(buildPersistedRuntimeConfig());
};

const { config: persistedRuntimeConfig, status: loadedRuntimeConfigStatus } =
  await runtimeConfigStore.load();
runtimeConfigStatus = loadedRuntimeConfigStatus;
if (persistedRuntimeConfig) {
  applyPersistedRuntimeConfig(persistedRuntimeConfig);
  console.info(`[runtime-config] Configuracao carregada (fonte: ${runtimeConfigStatus.source}).`);
}

restartHolyricsPull();

io.on("connection", (socket) => {
  const requestedChannel = getSafeChannel(socket.handshake.query?.channel);
  const room = roomFor(requestedChannel);
  socket.join(room);

  socket.emit("lyrics:update", toClientPayload(channelStates[requestedChannel], requestedChannel));

  socket.on("lyrics:set", (payload, ack) => {
    const target = String(payload?.target || "default").toLowerCase();

    const channels =
      target === "all"
        ? [CHANNELS.DEFAULT, CHANNELS.MUSIC, CHANNELS.BIBLE]
        : [getSafeChannel(target)];

    const results = applyUpdateMany({
      texto: payload?.texto,
      estilo: payload?.estilo,
      source: "socket-panel",
      channels,
    });

    if (payload?.estilo && results.some((item) => item.changed)) {
      runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);
    }

    if (typeof ack === "function") {
      ack({
        ok: true,
        changed: results.some((item) => item.changed),
        channels,
      });
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/estado", (req, res) => {
  const channel = getSafeChannel(req.query?.channel);
  res.json(toClientPayload(channelStates[channel], channel));
});

app.get("/estado/all", (_req, res) => {
  res.json({
    default: toClientPayload(channelStates[CHANNELS.DEFAULT], CHANNELS.DEFAULT),
    music: toClientPayload(channelStates[CHANNELS.MUSIC], CHANNELS.MUSIC),
    bible: toClientPayload(channelStates[CHANNELS.BIBLE], CHANNELS.BIBLE),
  });
});

app.post("/letra", (req, res) => {
  const target = String(req.body?.target || req.body?.channel || "default").toLowerCase();

  const channels =
    target === "all"
      ? [CHANNELS.DEFAULT, CHANNELS.MUSIC, CHANNELS.BIBLE]
      : [getSafeChannel(target)];

  const results = applyUpdateMany({
    texto: req.body?.texto,
    estilo: req.body?.estilo,
    source: "http-post",
    channels,
  });

  if (req.body?.estilo && results.some((item) => item.changed)) {
    runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);
  }

  res.json({
    ok: true,
    changed: results.some((item) => item.changed),
    channels,
    state: channels.map((channel) => toClientPayload(channelStates[channel], channel)),
  });
});

app.post("/holyrics/webhook", (req, res) => {
  const texto =
    req.body?.texto ||
    req.body?.text ||
    req.body?.lyric ||
    req.body?.current?.texto ||
    req.body?.current?.text ||
    "";

  const holyricsType = req.body?.type || req.body?.current?.type || req.body?.slide?.type || "";
  const channel = resolveIncomingHolyricsChannel({
    type: holyricsType,
    text: texto,
  });

  const extractedBibleInfo = extractBibleInfo(req.body || {});
  const sanitizedTexto = sanitizeHolyricsText(texto);
  const normalizedBible =
    channel === CHANNELS.BIBLE
      ? normalizeBibleContent({
          text: sanitizedTexto,
          bibleInfo: extractedBibleInfo,
        })
      : {
          text: sanitizedTexto,
          bibleInfo: extractedBibleInfo,
        };
  const result = applyUpdate({
    texto: normalizedBible.text,
    source: "holyrics-webhook",
    channel,
    bibleInfo: normalizedBible.bibleInfo,
    type: holyricsType,
  });
  mirrorToDefault({
    texto: normalizedBible.text,
    source: "holyrics-webhook",
    channel,
    bibleInfo: normalizedBible.bibleInfo,
    type: holyricsType,
  });

  if (channel !== CHANNELS.DEFAULT) {
    lastHolyricsContentChannel = channel;
  }

  res.json({ ok: true, changed: result.changed, channel });
});

app.get("/holyrics/config", (_req, res) => {
  res.json({
    ok: true,
    config: holyricsConfig,
  });
});

app.get("/layout/config", (_req, res) => {
  res.json({
    ok: true,
    config: layoutConfig,
  });
});

app.get("/holyrics/diagnostics", (_req, res) => {
  res.json({
    ok: true,
    diagnostics: holyricsDiagnostics,
  });
});

app.get("/runtime-config/status", (_req, res) => {
  res.json({
    ok: true,
    source: runtimeConfigStatus.source,
    warning: runtimeConfigStatus.warning,
  });
});

app.post("/holyrics/config", (req, res) => {
  holyricsConfig = sanitizeHolyricsConfig({
    ...holyricsConfig,
    ...(req.body || {}),
  });

  restartHolyricsPull();
  runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);

  res.json({
    ok: true,
    config: holyricsConfig,
  });
});

app.post("/layout/config", (req, res) => {
  layoutConfig = sanitizeLayoutConfig({
    ...layoutConfig,
    ...(req.body || {}),
  });

  const musicCurrent = channelStates[CHANNELS.MUSIC];
  // Reprocessa sempre a partir do texto BRUTO (pre-agrupamento), nunca do
  // `texto` ja transformado - senao cada troca de "agrupar a cada N linhas"
  // reagrupa um texto que ja tinha sido agrupado antes, degradando o
  // resultado a cada mudanca. `applyUpdate` ja aplica a transformacao
  // internamente, entao passamos o texto bruto direto para ele.
  const musicRawText = musicCurrent.textoOriginal ?? musicCurrent.texto;

  const musicChanged = applyUpdate({
    texto: musicRawText,
    estilo: musicCurrent.estilo,
    source: "layout-config",
    channel: CHANNELS.MUSIC,
    type: musicCurrent.type,
  });

  if (musicChanged.changed) {
    mirrorToDefault({
      texto: channelStates[CHANNELS.MUSIC].textoOriginal,
      estilo: channelStates[CHANNELS.MUSIC].estilo,
      source: "layout-config",
      channel: CHANNELS.MUSIC,
      type: channelStates[CHANNELS.MUSIC].type,
    });
  }

  runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);

  res.json({
    ok: true,
    config: layoutConfig,
  });
});

app.post(
  "/runtime-config/reset",
  asyncHandler(async (_req, res) => {
    await resetRuntimeConfigToDefaults();
    runtimeConfigStatus = { source: "file", warning: null };

    res.json({
      ok: true,
      config: buildPersistedRuntimeConfig(),
    });
  })
);

app.get("/presets", (_req, res) => {
  res.json({ ok: true, presets });
});

app.post("/presets", (req, res) => {
  const preset = sanitizePreset({ name: req.body?.name, style: req.body?.style });
  presets = [...presets, preset];
  runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);

  res.json({ ok: true, preset });
});

app.put("/presets/:id", (req, res) => {
  const index = presets.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ ok: false, message: "Preset nao encontrado." });
  }

  const updated = sanitizePreset(req.body || {}, presets[index]);
  presets = [...presets.slice(0, index), updated, ...presets.slice(index + 1)];
  runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);

  res.json({ ok: true, preset: updated });
});

app.delete("/presets/:id", (req, res) => {
  const exists = presets.some((item) => item.id === req.params.id);
  if (!exists) {
    return res.status(404).json({ ok: false, message: "Preset nao encontrado." });
  }

  presets = presets.filter((item) => item.id !== req.params.id);
  runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);

  res.json({ ok: true });
});

app.post("/presets/:id/apply", (req, res) => {
  const preset = presets.find((item) => item.id === req.params.id);
  if (!preset) {
    return res.status(404).json({ ok: false, message: "Preset nao encontrado." });
  }

  const target = String(req.body?.target || "default").toLowerCase();
  const channels =
    target === "all"
      ? [CHANNELS.DEFAULT, CHANNELS.MUSIC, CHANNELS.BIBLE]
      : [getSafeChannel(target)];

  // So estilo - `texto` fica de fora do payload de proposito, entao
  // `applyUpdateMany` preserva o texto atual de cada canal (ver o fix de
  // `applyUpdate` acima para updates so-de-estilo).
  const results = applyUpdateMany({
    estilo: preset.style,
    source: "preset-apply",
    channels,
  });

  if (results.some((item) => item.changed)) {
    runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);
  }

  res.json({ ok: true, changed: results.some((item) => item.changed), channels });
});

app.post("/presets/import", (req, res) => {
  const incoming = Array.isArray(req.body?.presets) ? req.body.presets : null;
  if (!incoming) {
    return res
      .status(400)
      .json({ ok: false, message: "Corpo invalido: esperado { presets: [] }." });
  }

  const imported = [];
  const errors = [];

  incoming.forEach((item, index) => {
    if (!isPlainObject(item) || !isPlainObject(item.style)) {
      errors.push({ index, message: "Item invalido: esperado um objeto com 'style'." });
      return;
    }

    const preset = sanitizePreset({ name: item.name, style: item.style });
    presets = [...presets, preset];
    imported.push(preset);
  });

  if (imported.length > 0) {
    runtimeConfigStore.schedulePersist(buildPersistedRuntimeConfig);
  }

  res.json({ ok: errors.length === 0, imported, errors });
});

app.post(
  "/holyrics/pull-now",
  asyncHandler(async (_req, res) => {
    if (!holyricsRunner) {
      return res.status(503).json({ ok: false, message: "Integracao Holyrics indisponivel." });
    }

    holyricsDiagnostics.lastAttemptAt = new Date().toISOString();
    const result = await holyricsRunner.fetchNow();

    if (result?.url) {
      holyricsDiagnostics.lastUrl = result.url;
    }

    if (result?.ok) {
      holyricsDiagnostics.lastError = null;
    }

    if (result?.type) {
      holyricsDiagnostics.lastType = result.type;
      holyricsDiagnostics.lastChannel = resolveHolyricsChannel(result.type);
    }

    if (result?.responseData !== undefined) {
      try {
        holyricsDiagnostics.lastResponsePreview = JSON.stringify(result.responseData).slice(0, 400);
      } catch (_error) {
        holyricsDiagnostics.lastResponsePreview = "[unserializable_response]";
      }
    }

    if (!result?.ok && result?.error) {
      holyricsDiagnostics.lastError = result.error;
    }

    return res.json({ ok: true, result, diagnostics: holyricsDiagnostics });
  })
);

// Varre a rede local procurando uma maquina respondendo como o Holyrics
// (mesmo host/porta/path/token configurados), para o operador nao precisar
// descobrir manualmente o IP da maquina do Holyrics (ex: rodando `ipconfig`
// nela). Usa a config atualmente salva, a menos que o body traga overrides.
app.post(
  "/holyrics/discover",
  asyncHandler(async (req, res) => {
    const overrides = req.body || {};
    const result = await discoverHolyricsHosts({
      port: Number(overrides.port) || holyricsConfig.port,
      path: overrides.path || holyricsConfig.path,
      method: overrides.method || holyricsConfig.method,
      token: overrides.token ?? holyricsConfig.token,
      tokenHeader: overrides.tokenHeader || holyricsConfig.tokenHeader,
    });

    res.json({ ok: true, ...result });
  })
);

// Qualquer rota nao encontrada volta como JSON (nao a pagina HTML padrao do
// Express), para nao quebrar clientes que sempre esperam `response.json()`.
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Rota nao encontrada: ${req.method} ${req.path}`,
  });
});

// Precisa ser o ULTIMO middleware registrado. Captura qualquer erro lancado
// (sincrono) ou encaminhado via `next(err)`/asyncHandler (assincrono) e
// responde em JSON com status 500, em vez de deixar o Express cair no
// handler padrao dele, que responde com uma pagina HTML.
app.use((err, _req, res, _next) => {
  console.error("[server] Erro nao tratado:", err);
  res.status(500).json({ ok: false, message: err?.message || "Erro interno." });
});

const port = Number(process.env.PORT) || 3001;
const host = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[server] ${host}:${port} ja esta em uso. Encerre o processo antigo ou altere HOST/PORT no .env.`
    );
    return;
  }

  console.error("[server] Erro ao iniciar:", error);
});

server.listen(port, host, () => {
  const urls = resolveServerUrls(host, port);
  for (const baseUrl of urls) {
    console.log(`[server] Rodando em ${baseUrl}`);
    console.log(`[server] Display default para vMix: ${baseUrl}/display`);
    console.log(`[server] Display musica para vMix: ${baseUrl}/display/music`);
    console.log(`[server] Display biblia para vMix: ${baseUrl}/display/bible`);
  }
});
