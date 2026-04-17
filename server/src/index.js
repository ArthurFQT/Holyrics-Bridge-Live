import "dotenv/config";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { startHolyricsPull } from "./holyricsClient.js";
import {
  CHANNELS,
  createInitialChannelStates,
  getSafeChannel,
  mergeState,
  resolveHolyricsChannel,
  sanitizeHolyricsConfig,
  toClientPayload
} from "./state.js";

const app = express();
const server = http.createServer(app);

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
    origin: parsePanelOrigin(process.env.PANEL_ORIGIN)
  },
  transports: ["websocket"]
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let channelStates = createInitialChannelStates();
let holyricsRunner;
let lastHolyricsContentChannel = null;
let layoutConfig = {
  music: {
    breakEveryLines: 0
  }
};
const holyricsDiagnostics = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastUrl: null,
  lastTextLength: 0,
  lastResponsePreview: null,
  lastType: null,
  lastChannel: null
};

let holyricsConfig = sanitizeHolyricsConfig({
  host: process.env.HOLYRICS_HOST,
  port: process.env.HOLYRICS_PORT,
  path: process.env.HOLYRICS_PATH,
  method: process.env.HOLYRICS_METHOD,
  token: process.env.HOLYRICS_TOKEN,
  tokenHeader: process.env.HOLYRICS_TOKEN_HEADER,
  textPath: process.env.HOLYRICS_TEXT_PATH,
  pullEnabled: process.env.HOLYRICS_PULL_ENABLED === "true",
  pullIntervalMs: process.env.HOLYRICS_PULL_INTERVAL_MS,
  timeoutMs: process.env.HOLYRICS_TIMEOUT_MS
});

const clampMusicBreakLines = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 2) {
    return 0;
  }
  return Math.min(Math.max(Math.round(parsed), 2), 12);
};

const sanitizeLayoutConfig = (input) => ({
  music: {
    breakEveryLines: clampMusicBreakLines(input?.music?.breakEveryLines)
  }
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

const applyUpdate = ({ texto, estilo, source, channel }) => {
  const safeChannel = getSafeChannel(channel);
  const transformedText = transformTextByChannel(texto, safeChannel);
  const currentState = channelStates[safeChannel];
  const { changed, state } = mergeState(currentState, {
    texto: transformedText,
    estilo,
    source
  });
  channelStates = {
    ...channelStates,
    [safeChannel]: state
  };

  if (changed) {
    emitState(safeChannel);
  }

  return {
    changed,
    channel: safeChannel,
    state
  };
};

const mirrorToDefault = ({ texto, estilo, source, channel }) => {
  if (channel === CHANNELS.DEFAULT) {
    return;
  }

  applyUpdate({
    texto,
    estilo,
    source: `${source}:default-mirror`,
    channel: CHANNELS.DEFAULT
  });
};

const applyUpdateMany = ({ texto, estilo, source, channels }) => {
  const targetChannels = (channels || [CHANNELS.DEFAULT]).map(getSafeChannel);
  const uniqueChannels = [...new Set(targetChannels)];
  const results = [];

  for (const channel of uniqueChannels) {
    const result = applyUpdate({ texto, estilo, source, channel });
    results.push(result);
    mirrorToDefault({ texto, estilo, source, channel });
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
    onLyric: ({ text, type }) => {
      const holyricsChannel = resolveIncomingHolyricsChannel({ type, text });
      applyUpdate({ texto: text, source: "holyrics-pull", channel: holyricsChannel });
      mirrorToDefault({ texto: text, source: "holyrics-pull", channel: holyricsChannel });

      if (holyricsChannel !== CHANNELS.DEFAULT) {
        lastHolyricsContentChannel = holyricsChannel;
      }

      holyricsDiagnostics.lastSuccessAt = new Date().toISOString();
      holyricsDiagnostics.lastTextLength = text.length;
      holyricsDiagnostics.lastError = null;
      holyricsDiagnostics.lastType = type || null;
      holyricsDiagnostics.lastChannel = holyricsChannel;
    },
    onError: (error) => {
      holyricsDiagnostics.lastError = error?.message || "Erro desconhecido";
    },
    logger: console
  });
};

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
      channels
    });

    if (typeof ack === "function") {
      ack({ ok: true, changed: results.some((item) => item.changed), channels });
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
    bible: toClientPayload(channelStates[CHANNELS.BIBLE], CHANNELS.BIBLE)
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
    channels
  });

  res.json({
    ok: true,
    changed: results.some((item) => item.changed),
    channels,
    state: channels.map((channel) => toClientPayload(channelStates[channel], channel))
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

  const channel = resolveIncomingHolyricsChannel({
    type: req.body?.type || req.body?.current?.type || req.body?.slide?.type,
    text: texto
  });

  const result = applyUpdate({ texto, source: "holyrics-webhook", channel });
  mirrorToDefault({ texto, source: "holyrics-webhook", channel });

  if (channel !== CHANNELS.DEFAULT) {
    lastHolyricsContentChannel = channel;
  }

  res.json({ ok: true, changed: result.changed, channel });
});

app.get("/holyrics/config", (_req, res) => {
  res.json({
    ok: true,
    config: holyricsConfig
  });
});

app.get("/layout/config", (_req, res) => {
  res.json({
    ok: true,
    config: layoutConfig
  });
});

app.get("/holyrics/diagnostics", (_req, res) => {
  res.json({
    ok: true,
    diagnostics: holyricsDiagnostics
  });
});

app.post("/holyrics/config", (req, res) => {
  holyricsConfig = sanitizeHolyricsConfig({
    ...holyricsConfig,
    ...(req.body || {})
  });

  restartHolyricsPull();

  res.json({
    ok: true,
    config: holyricsConfig
  });
});

app.post("/layout/config", (req, res) => {
  layoutConfig = sanitizeLayoutConfig({
    ...layoutConfig,
    ...(req.body || {})
  });

  const musicCurrent = channelStates[CHANNELS.MUSIC];
  const musicReformatted = transformTextByChannel(musicCurrent.texto, CHANNELS.MUSIC);
  const musicChanged = applyUpdate({
    texto: musicReformatted,
    estilo: musicCurrent.estilo,
    source: "layout-config",
    channel: CHANNELS.MUSIC
  });

  if (musicChanged.changed) {
    mirrorToDefault({
      texto: channelStates[CHANNELS.MUSIC].texto,
      estilo: channelStates[CHANNELS.MUSIC].estilo,
      source: "layout-config",
      channel: CHANNELS.MUSIC
    });
  }

  res.json({
    ok: true,
    config: layoutConfig
  });
});

app.post("/holyrics/pull-now", async (_req, res) => {
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
});

const port = Number(process.env.PORT) || 3001;
const host = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

const resolveServerUrls = (listenHost, listenPort) => {
  const normalizedHost = String(listenHost || "").trim().toLowerCase();
  const onAllInterfaces = normalizedHost === "0.0.0.0" || normalizedHost === "::";
  const urls = new Set();

  if (onAllInterfaces) {
    urls.add(`http://localhost:${listenPort}`);

    const interfaces = os.networkInterfaces();
    for (const addresses of Object.values(interfaces)) {
      for (const address of addresses || []) {
        if (address.family === "IPv4" && !address.internal) {
          urls.add(`http://${address.address}:${listenPort}`);
        }
      }
    }
  } else {
    urls.add(`http://${listenHost}:${listenPort}`);
  }

  return [...urls];
};

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
