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

const toCleanText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toCleanText(item))
      .filter(Boolean)
      .join(",");
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
};

const getFirstTextByPaths = (data, paths = []) => {
  for (const path of paths) {
    const value = toCleanText(getByPath(data, path));
    if (value) {
      return value;
    }
  }

  return "";
};

const normalizeInlineSpaces = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const stripHtmlTags = (value) => String(value || "").replace(/<[^>]*>/g, " ");

const cleanBibleVersionText = (value) => {
  const cleaned = normalizeInlineSpaces(stripHtmlTags(value));
  if (!cleaned) {
    return "";
  }

  return cleaned.replace(/^\(([^)]+)\)$/, "$1").trim();
};

const cleanBibleReferenceText = (value) => normalizeInlineSpaces(stripHtmlTags(value));

const looksLikeBibleAbbreviationLine = (line) =>
  /^\(?\s*[A-Z]{2,8}\s*\)?$/.test(String(line || "").trim());

// Uma linha de versao real e sempre curta (ex: "ACF" ou "A Biblia Sagrada,
// Almeida Corrigida Fiel | acf"), nunca uma frase inteira do versiculo - o
// guard de tamanho evita que um texto biblico longo seja avaliado aqui. As
// palavras-chave usam limite de palavra (`\b`) para nao casar como
// substring dentro de palavras comuns do portugues (ex: "ara" aparece
// dentro de "para" e "separacao", "arc" aparece dentro de "marca") - sem o
// `\b`, um versiculo comum era classificado como linha de versao e o texto
// inteiro era descartado, sobrando so a referencia (bug real observado com
// Genesis 1:4, que contem "separacao").
const looksLikeBibleVersionLine = (line) => {
  const value = normalizeInlineSpaces(line);
  if (!value || value.length > 80) {
    return false;
  }

  if (value.includes("|")) {
    return true;
  }

  return /\b(?:b[ií]blia|bible|almeida|nvi|acf|ara|arc|nvt|ntlh|king james|kjv|vers[aã]o)\b/i.test(
    value
  );
};

const looksLikeBibleReferenceLine = (line) => {
  const value = normalizeInlineSpaces(line);
  if (!value || value.length > 100) {
    return false;
  }

  return /\b\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\b/.test(value);
};

const equalsIgnoringCaseAndExtraSpaces = (left, right) =>
  normalizeInlineSpaces(left).toLowerCase() === normalizeInlineSpaces(right).toLowerCase();

const isBibleVersionAbbreviation = (value) => /^[A-Z0-9]{2,8}$/i.test(cleanBibleVersionText(value));

const pickBestBibleVersion = (currentValue, nextValue) => {
  const current = cleanBibleVersionText(currentValue);
  const next = cleanBibleVersionText(nextValue);

  if (!next) {
    return current;
  }

  if (!current) {
    return next;
  }

  const currentIsAbbr = isBibleVersionAbbreviation(current);
  const nextIsAbbr = isBibleVersionAbbreviation(next);

  if (currentIsAbbr && !nextIsAbbr) {
    return next;
  }

  if (!currentIsAbbr && nextIsAbbr) {
    return current;
  }

  const currentHasPipe = current.includes("|");
  const nextHasPipe = next.includes("|");
  if (!currentHasPipe && nextHasPipe) {
    return next;
  }

  if (currentHasPipe && !nextHasPipe) {
    return current;
  }

  return next.length > current.length ? next : current;
};

export const extractBibleInfo = (data) => {
  if (!data || typeof data !== "object") {
    return {
      version: "",
      reference: "",
    };
  }

  const version = cleanBibleVersionText(
    getFirstTextByPaths(data, [
      "map.version",
      "map.bibleVersion",
      "map.version_abbr",
      "map.versionAbbr",
      "version_abbr",
      "versionAbbr",
      "version",
      "versao",
      "bibleVersion",
      "current.version",
      "current.version_abbr",
      "current.versionAbbr",
      "slide.version",
    ])
  );

  const directReference = getFirstTextByPaths(data, [
    "map.reference",
    "map.ref",
    "map.header",
    "map.verse_ref",
    "map.verseRef",
    "reference",
    "ref",
    "header",
    "verse_ref",
    "verseRef",
    "current.reference",
    "current.header",
    "current.ref",
    "slide.header",
    "slide.reference",
  ]);

  const book = getFirstTextByPaths(data, [
    "map.book_name",
    "map.bookName",
    "map.book",
    "book_name",
    "bookName",
    "book",
    "livro",
    "current.book",
    "slide.book",
  ]);

  const chapter = getFirstTextByPaths(data, [
    "map.chapter",
    "chapter",
    "capitulo",
    "current.chapter",
    "slide.chapter",
  ]);

  const verse = getFirstTextByPaths(data, [
    "map.verse",
    "map.verses",
    "verse",
    "verses",
    "versiculo",
    "current.verse",
    "slide.verse",
  ]);

  let reference = cleanBibleReferenceText(directReference);

  if (!reference) {
    if (book && chapter && verse) {
      reference = cleanBibleReferenceText(`${book} ${chapter}:${verse}`);
    } else if (book && chapter) {
      reference = cleanBibleReferenceText(`${book} ${chapter}`);
    } else if (chapter && verse) {
      reference = cleanBibleReferenceText(`${chapter}:${verse}`);
    } else if (book) {
      reference = cleanBibleReferenceText(book);
    }
  }

  return {
    version,
    reference,
  };
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
    "slide.text",
  ].filter(Boolean);

  for (const path of candidates) {
    const value = getByPath(data, path);
    if (typeof value === "string") {
      return { found: true, text: value };
    }
  }

  return { found: false, text: "" };
};

const inferTypeFromContent = (data, text) => {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) {
    return "";
  }

  const looksLikeBible =
    /\b(?:genesis|gênesis|exodo|êxodo|levitico|levítico|numeros|números|deuteronômio|josué|juízes|rute|1 samuel|2 samuel|1 reis|2 reis|1 cronicas|2 cronicas|esdras|neemias|ester|joão|mateus|marcos|lucas|joão|atos|romanos|coríntios|gálatas|efésios|filipenses|colossenses|tessalonicenses|timóteo|tiago|pedro|judas|apocalipse|psalm|salmo|provérbios|provérbios|isaias|jeremias|ezequiel|daniel|oseias|joel|amós|obadias|jonas|miqueias|naum|habacuque|sofonias|ageu|zacarias|malaquias)\b/i.test(
      normalizedText
    );

  const hasBibleReference = /\b\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\b/.test(normalizedText);

  if (looksLikeBible || hasBibleReference) {
    return "BIBLE";
  }

  return "";
};

const resolveType = (data) => {
  if (!data || typeof data !== "object") {
    return "";
  }

  const candidates = ["map.type", "type", "current.type", "slide.type"];

  for (const path of candidates) {
    const value = getByPath(data, path);
    if (value === null || value === undefined) {
      continue;
    }

    const stringValue = typeof value === "string" ? value : String(value);
    const trimmed = stringValue.trim();
    const normalized = trimmed.toUpperCase();

    if (!trimmed || ["EMPTY", "NULL", "UNDEFINED"].includes(normalized)) {
      continue;
    }

    return trimmed;
  }

  const resolvedText = resolveText(data, "map.text");
  return inferTypeFromContent(data, resolvedText.text);
};

const createHeaders = (config) => {
  if (!config.token) {
    return {};
  }

  if (config.tokenHeader.toLowerCase() === "authorization") {
    return {
      Authorization: `Bearer ${config.token}`,
    };
  }

  return {
    [config.tokenHeader]: config.token,
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

const splitBibleTextFromInlineMeta = (text, bibleInfo = {}) => {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const indexesToRemove = new Set();
  let version = cleanBibleVersionText(bibleInfo.version);
  let reference = cleanBibleReferenceText(bibleInfo.reference);
  const versionCandidates = [];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (looksLikeBibleAbbreviationLine(line)) {
      versionCandidates.push(cleanBibleVersionText(line));
      indexesToRemove.add(index);
      continue;
    }

    if (looksLikeBibleVersionLine(line)) {
      versionCandidates.push(cleanBibleVersionText(line));
      indexesToRemove.add(index);
      continue;
    }

    if (!reference && looksLikeBibleReferenceLine(line)) {
      reference = cleanBibleReferenceText(line);
      indexesToRemove.add(index);
    }
  }

  for (const candidate of versionCandidates) {
    version = pickBestBibleVersion(version, candidate);
  }

  if (version) {
    for (let index = 0; index < lines.length; index += 1) {
      if (equalsIgnoringCaseAndExtraSpaces(lines[index], version)) {
        indexesToRemove.add(index);
      }
    }
  }

  if (reference) {
    for (let index = 0; index < lines.length; index += 1) {
      if (equalsIgnoringCaseAndExtraSpaces(lines[index], reference)) {
        indexesToRemove.add(index);
      }
    }
  }

  const bodyText = lines
    .filter((_line, index) => !indexesToRemove.has(index))
    .join("\n")
    .trim();

  return {
    text: bodyText,
    bibleInfo: {
      version,
      reference,
    },
  };
};

export const normalizeBibleContent = ({ text, bibleInfo }) =>
  splitBibleTextFromInlineMeta(sanitizeHolyricsText(text), bibleInfo);

export { sanitizeHolyricsText };

export const startHolyricsPull = ({ config, onLyric, onError, logger = console }) => {
  let timer;
  let running = false;

  const fetchNow = async () => {
    if (!config.pullEnabled || running) {
      return {
        ok: false,
        skipped: !config.pullEnabled ? "pull_disabled" : "already_running",
      };
    }

    running = true;

    try {
      const response = await axios({
        method: config.method,
        url: createUrl(config),
        timeout: config.timeoutMs,
        headers: createHeaders(config),
      });

      const resolved = resolveText(response.data, config.textPath);
      const holyricsType = resolveType(response.data);
      const extractedBibleInfo = extractBibleInfo(response.data);
      const sanitizedText = sanitizeHolyricsText(resolved.text);
      const isBible = /BIBLE|VERSE|VERS[IÍ]CULO|B[IÍ]BLIA/.test(
        String(holyricsType || "").toUpperCase()
      );
      const normalizedBible = isBible
        ? splitBibleTextFromInlineMeta(sanitizedText, extractedBibleInfo)
        : {
            text: sanitizedText,
            bibleInfo: extractedBibleInfo,
          };

      if (resolved.found) {
        onLyric({
          text: normalizedBible.text,
          type: holyricsType,
          bibleInfo: normalizedBible.bibleInfo,
          raw: response.data,
        });
      }

      return {
        ok: true,
        url: createUrl(config),
        textoFound: resolved.found,
        textoLength: normalizedBible.text.length,
        type: holyricsType,
        bibleInfo: normalizedBible.bibleInfo,
        responseData: response.data,
      };
    } catch (error) {
      onError?.(error);
      logger.warn(`[holyrics] Falha ao consultar API: ${error.message}`);

      return {
        ok: false,
        url: createUrl(config),
        error: error.message,
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
    fetchNow,
  };
};
