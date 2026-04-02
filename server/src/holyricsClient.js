import axios from "axios";

const getByPath = (obj, path) => {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce((acc, segment) => {
    if (acc === null || typeof acc !== "object") {
      return undefined;
    }

    return acc[segment];
  }, obj);
};

const resolveText = (data, preferredPath) => {
  if (typeof data === "string") {
    return { found: true, text: data };
  }

  const candidates = [
    preferredPath,
    "map.text",
    "texto",
    "text",
    "lyric",
    "current.texto",
    "current.text",
    "slide.text"
  ].filter(Boolean);

  for (const path of candidates) {
    const value = getByPath(data, path);
    if (typeof value === "string") {
      return { found: true, text: value };
    }
  }

  return { found: false, text: "" };
};

const resolveType = (data) => {
  if (!data || typeof data !== "object") {
    return "";
  }

  const candidates = ["map.type", "type", "current.type", "slide.type"];

  for (const path of candidates) {
    const value = getByPath(data, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const createHeaders = (config) => {
  if (!config.token) {
    return {};
  }

  if (config.tokenHeader.toLowerCase() === "authorization") {
    return {
      Authorization: `Bearer ${config.token}`
    };
  }

  return {
    [config.tokenHeader]: config.token
  };
};

const createUrl = (config) => `http://${config.host}:${config.port}${config.path}`;

const decodeHtmlEntities = (value) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const sanitizeHolyricsText = (text) => {
  const cleaned = String(text || "")
    .replace(/<span[^>]*id=['"]text-force-update_[^'"]*['"][^>]*>\s*<\/span>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|ctt)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  return decodeHtmlEntities(cleaned)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};

export const startHolyricsPull = ({ config, onLyric, onError, logger = console }) => {
  let timer;
  let running = false;

  const fetchNow = async () => {
    if (!config.pullEnabled || running) {
      return {
        ok: false,
        skipped: !config.pullEnabled ? "pull_disabled" : "already_running"
      };
    }

    running = true;

    try {
      const response = await axios({
        method: config.method,
        url: createUrl(config),
        timeout: config.timeoutMs,
        headers: createHeaders(config)
      });

      const resolved = resolveText(response.data, config.textPath);
      const holyricsType = resolveType(response.data);
      const sanitizedText = sanitizeHolyricsText(resolved.text);

      if (resolved.found) {
        onLyric({
          text: sanitizedText,
          type: holyricsType,
          raw: response.data
        });
      }

      return {
        ok: true,
        url: createUrl(config),
        textoFound: resolved.found,
        textoLength: sanitizedText.length,
        type: holyricsType,
        responseData: response.data
      };
    } catch (error) {
      onError?.(error);
      logger.warn(`[holyrics] Falha ao consultar API: ${error.message}`);

      return {
        ok: false,
        url: createUrl(config),
        error: error.message
      };
    } finally {
      running = false;
    }
  };

  if (config.pullEnabled) {
    fetchNow();
    timer = setInterval(fetchNow, config.pullIntervalMs);
    logger.info(`[holyrics] Pull ativo em ${createUrl(config)} (${config.pullIntervalMs}ms)`);
  } else {
    logger.info("[holyrics] Pull desativado. Use webhook ou ative pull no painel.");
  }

  return {
    stop: () => {
      if (timer) {
        clearInterval(timer);
      }
    },
    fetchNow
  };
};
