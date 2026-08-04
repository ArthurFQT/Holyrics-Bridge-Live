import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const CHANNELS = [
  { id: "default", label: "Default" },
  { id: "music", label: "Musica" },
  { id: "bible", label: "Biblia" }
];

const BIBLE_META_POSITIONS = [
  { value: "top-left", label: "Topo esquerdo" },
  { value: "top-center", label: "Topo centro" },
  { value: "top-right", label: "Topo direito" },
  { value: "bottom-left", label: "Rodape esquerdo" },
  { value: "bottom-center", label: "Rodape centro" },
  { value: "bottom-right", label: "Rodape direito" }
];

const FONT_OPTIONS = [
  { value: '"Manrope", "Segoe UI", sans-serif', label: "Manrope" },
  { value: '"Sora", "Manrope", sans-serif', label: "Sora" },
  { value: '"Montserrat", "Arial", sans-serif', label: "Montserrat" },
  { value: '"Poppins", "Arial", sans-serif', label: "Poppins" },
  { value: '"Inter", "Segoe UI", sans-serif', label: "Inter" },
  { value: '"Roboto", "Arial", sans-serif', label: "Roboto" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: '"Times New Roman", serif', label: "Times New Roman" },
  { value: "custom", label: "Personalizada" }
];

const FONT_FALLBACKS = {
  "Montserrat, sans-serif": '"Montserrat", "Arial", sans-serif',
  "Poppins, sans-serif": '"Poppins", "Arial", sans-serif',
  "Inter, sans-serif": '"Inter", "Segoe UI", sans-serif',
  "Roboto, sans-serif": '"Roboto", "Arial", sans-serif',
  "Sora, sans-serif": '"Sora", "Manrope", sans-serif',
  "Manrope, sans-serif": '"Manrope", "Segoe UI", sans-serif'
};

const initialStyle = {
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
  fade: false
};

const initialHolyricsConfig = {
  host: "127.0.0.1",
  port: 8080,
  path: "/view/text.json",
  method: "GET",
  token: "",
  tokenHeader: "Authorization",
  textPath: "map.text",
  pullEnabled: true,
  pullIntervalMs: 400,
  timeoutMs: 1500
};

const initialLayoutConfig = {
  music: {
    breakEveryLines: 0
  }
};

const createInitialDrafts = () =>
  CHANNELS.reduce((acc, channel) => {
    acc[channel.id] = {
      texto: "",
      style: { ...initialStyle },
      bibleInfo: {
        version: "",
        reference: ""
      },
      type: ""
    };
    return acc;
  }, {});

const parseServerStyle = (style = {}) => {
  const parsedBackgroundMode =
    style.backgroundMode || (style.backgroundTransparent ? "transparent" : "solid");

  return {
    ...initialStyle,
    ...style,
    backgroundMode: parsedBackgroundMode,
    fontSize: Number(String(style.fontSize || initialStyle.fontSize).replace("px", "")) || initialStyle.fontSize,
    bibleVersionFontSize:
      Number(String(style.bibleVersionFontSize || initialStyle.bibleVersionFontSize).replace("px", "")) ||
      initialStyle.bibleVersionFontSize,
    bibleReferenceFontSize:
      Number(String(style.bibleReferenceFontSize || initialStyle.bibleReferenceFontSize).replace("px", "")) ||
      initialStyle.bibleReferenceFontSize,
    shadowEnabled: style.shadowEnabled ?? style.textShadow !== "none"
  };
};

const buildStylePayload = (style) => ({
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
  fade: style.fade
});

const parseBibleInfo = (info = {}) => ({
  version: typeof info?.version === "string" ? info.version.trim() : "",
  reference: typeof info?.reference === "string" ? info.reference.trim() : ""
});

const parseType = (value) => (typeof value === "string" ? value.trim() : "");

const toPreviewMetaClass = (position = "top-right") => {
  const normalized = String(position || "").toLowerCase();
  if (
    [
      "top-left",
      "top-center",
      "top-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ].includes(normalized)
  ) {
    return `preview-${normalized}`;
  }

  return "preview-top-right";
};

const getFontSelectValue = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  return FONT_OPTIONS.some((option) => option.value === selected) ? selected : "custom";
};

const getCustomFontInputValue = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  return FONT_OPTIONS.some((option) => option.value === selected) ? "" : selected;
};

const normalizeFontFamilySelection = (fontFamily) => {
  const selected = String(fontFamily || initialStyle.fontFamily).trim();
  if (FONT_OPTIONS.some((option) => option.value === selected)) {
    return selected;
  }

  if (FONT_FALLBACKS[selected]) {
    return FONT_FALLBACKS[selected];
  }

  return selected || initialStyle.fontFamily;
};

const ensureGoogleFontImport = (url) => {
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

const buildPreviewBackground = (style) => {
  if (style.backgroundMode === "solid") {
    return style.backgroundColor;
  }

  if (style.backgroundMode === "gradient") {
    return `linear-gradient(${style.gradientDirection}, ${style.gradientColor} 0%, transparent ${style.gradientSpread}%)`;
  }

  return "linear-gradient(140deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 100%)";
};

const joinFieldClasses = (...classes) => classes.filter(Boolean).join(" ");

const FieldLabel = ({ children, className = "", fullWidth = false, inline = false }) => (
  <label className={joinFieldClasses("field", className, fullWidth && "field-full", inline && "inline")}>
    {children}
  </label>
);

const TextField = ({ label, value, onChange, placeholder, fullWidth = false, className = "", ...props }) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="text" value={value} onChange={onChange} placeholder={placeholder} {...props} />
  </FieldLabel>
);

const NumberField = ({ label, value, onChange, fullWidth = false, className = "", ...props }) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="number" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

const ColorField = ({ label, value, onChange, fullWidth = false, className = "", ...props }) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="color" className="custom-color" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

const RangeField = ({ label, value, onChange, fullWidth = false, className = "", ...props }) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="range" className="custom-range" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

const SelectField = ({ label, value, onChange, children, fullWidth = false, disabled = false, className = "", ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const options = useMemo(() => {
    const items = Array.isArray(children) ? children : [children];

    return items
      .filter(Boolean)
      .map((child) => ({
        value: child?.props?.value ?? "",
        label: child?.props?.children ?? child?.props?.value ?? ""
      }));
  }, [children]);

  const selectedOption = options.find((option) => option.value === value) || options[0] || {};

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <FieldLabel fullWidth={fullWidth} className={joinFieldClasses("custom-select-field", className)}>
      <span>{label}</span>
      <div className="custom-select-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className={joinFieldClasses("custom-select-trigger", isOpen && "open")}
          disabled={disabled}
          aria-expanded={isOpen}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          {...props}
        >
          <span className="custom-select-value">{selectedOption.label || value}</span>
          <span className="custom-select-arrow" aria-hidden="true" />
        </button>

        <div className={joinFieldClasses("custom-select-menu", isOpen && "open")}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={joinFieldClasses("custom-select-option", option.value === value && "selected")}
              onClick={() => {
                onChange({ target: { value: option.value } });
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </FieldLabel>
  );
};

const CheckboxField = ({ label, checked, onChange, inline = false, fullWidth = false, className = "", ...props }) => (
  <FieldLabel inline={inline} fullWidth={fullWidth} className={joinFieldClasses("custom-checkbox-field", className)}>
    <span className="custom-checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} {...props} />
      <span className="checkbox-indicator" aria-hidden="true" />
    </span>
    <span className="checkbox-text">{label}</span>
  </FieldLabel>
);

const TextareaField = ({ label, value, onChange, placeholder, fullWidth = false, ...props }) => (
  <FieldLabel fullWidth={fullWidth}>
    <span>{label}</span>
    <textarea value={value} onChange={onChange} placeholder={placeholder} {...props} />
  </FieldLabel>
);

function App() {
  const [selectedChannel, setSelectedChannel] = useState("default");
  const [channelDrafts, setChannelDrafts] = useState(createInitialDrafts);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [holyricsConfig, setHolyricsConfig] = useState(initialHolyricsConfig);
  const [layoutConfig, setLayoutConfig] = useState(initialLayoutConfig);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    danger: false
  });
  const confirmResolverRef = useRef(null);

  const currentDraft = channelDrafts[selectedChannel] || {
    texto: "",
    style: initialStyle,
    bibleInfo: { version: "", reference: "" },
    type: ""
  };
  const currentStyle = currentDraft.style;
  const isBottomPosition = (position) => String(position || "").toLowerCase().startsWith("bottom");
  const isTopPosition = (position) => String(position || "").toLowerCase().startsWith("top");
  const showPreviewVersion = selectedChannel === "bible" && currentStyle.showBibleVersion;
  const showPreviewReference = selectedChannel === "bible" && currentStyle.showBibleReference;
  const samePreviewMetaPosition =
    showPreviewVersion &&
    showPreviewReference &&
    currentStyle.bibleVersionPosition === currentStyle.bibleReferencePosition;

  const previewVersionOffsetPx =
    samePreviewMetaPosition && isBottomPosition(currentStyle.bibleVersionPosition)
      ? Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.2) + 10
      : 0;

  const previewReferenceOffsetPx =
    samePreviewMetaPosition && isTopPosition(currentStyle.bibleReferencePosition)
      ? Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.2) + 10
      : 0;

  let previewTopPaddingPx = 20;
  if (showPreviewVersion && isTopPosition(currentStyle.bibleVersionPosition)) {
    previewTopPaddingPx = Math.max(
      previewTopPaddingPx,
      Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.35) + 26
    );
  }
  if (showPreviewReference && isTopPosition(currentStyle.bibleReferencePosition)) {
    previewTopPaddingPx = Math.max(
      previewTopPaddingPx,
      Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.35) + 26 + previewReferenceOffsetPx
    );
  }

  let previewBottomPaddingPx = 20;
  if (showPreviewVersion && isBottomPosition(currentStyle.bibleVersionPosition)) {
    previewBottomPaddingPx = Math.max(
      previewBottomPaddingPx,
      Math.round((Number(currentStyle.bibleVersionFontSize) || 32) * 1.35) + 26 + previewVersionOffsetPx
    );
  }
  if (showPreviewReference && isBottomPosition(currentStyle.bibleReferencePosition)) {
    previewBottomPaddingPx = Math.max(
      previewBottomPaddingPx,
      Math.round((Number(currentStyle.bibleReferenceFontSize) || 40) * 1.35) + 26
    );
  }

  const closeConfirmDialog = useCallback((result) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }

    setConfirmDialog((prev) => ({
      ...prev,
      open: false
    }));
  }, []);

  const confirmAction = useCallback(
    ({
      title = "Confirmar acao",
      message = "Deseja continuar?",
      confirmLabel = "Confirmar",
      cancelLabel = "Cancelar",
      danger = false
    }) =>
      new Promise((resolve) => {
        confirmResolverRef.current = resolve;
        setConfirmDialog({
          open: true,
          title,
          message,
          confirmLabel,
          cancelLabel,
          danger
        });
      }),
    []
  );

  const updateDraft = useCallback((channel, updater) => {
    setChannelDrafts((prev) => {
      const current = prev[channel] || {
        texto: "",
        style: { ...initialStyle },
        bibleInfo: { version: "", reference: "" },
        type: ""
      };
      const nextPartial = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [channel]: {
          ...current,
          ...nextPartial,
          style: {
            ...current.style,
            ...(nextPartial?.style || {})
          },
          bibleInfo: {
            ...current.bibleInfo,
            ...(nextPartial?.bibleInfo || {})
          }
        }
      };
    });
  }, []);

  const loadChannelState = useCallback(
    async (channel) => {
      const response = await fetch(`${BACKEND_URL}/estado?channel=${channel}`);
      const data = await response.json();

      updateDraft(channel, (current) => ({
        texto: typeof data?.texto === "string" ? data.texto : current.texto,
        style: data?.estilo ? parseServerStyle(data.estilo) : current.style,
        bibleInfo: parseBibleInfo(data?.meta?.bibleInfo),
        type: parseType(data?.meta?.type)
      }));
    },
    [updateDraft]
  );

  const socket = useMemo(
    () =>
      io(BACKEND_URL, {
        transports: ["websocket"],
        query: { channel: selectedChannel }
      }),
    [selectedChannel]
  );

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onUpdate = (payload) => {
      updateDraft(selectedChannel, (current) => ({
        texto: typeof payload?.texto === "string" ? payload.texto : current.texto,
        style: payload?.estilo ? parseServerStyle(payload.estilo) : current.style,
        bibleInfo: parseBibleInfo(payload?.meta?.bibleInfo),
        type: parseType(payload?.meta?.type)
      }));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lyrics:update", onUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lyrics:update", onUpdate);
      socket.close();
    };
  }, [selectedChannel, socket, updateDraft]);

  useEffect(
    () => () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!confirmDialog.open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeConfirmDialog(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeConfirmDialog, confirmDialog.open]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all(CHANNELS.map((channel) => loadChannelState(channel.id)));
      } catch (_error) {
        setStatus("Falha ao buscar estado inicial dos canais.");
      }

      try {
        const response = await fetch(`${BACKEND_URL}/holyrics/config`);
        const data = await response.json();

        if (data?.config) {
          setHolyricsConfig({
            ...initialHolyricsConfig,
            ...data.config
          });
        }
      } catch (_error) {
        setStatus("Falha ao buscar configuracao do Holyrics.");
      }

      try {
        const response = await fetch(`${BACKEND_URL}/layout/config`);
        const data = await response.json();

        if (data?.config) {
          setLayoutConfig({
            ...initialLayoutConfig,
            ...data.config,
            music: {
              ...initialLayoutConfig.music,
              ...(data.config.music || {})
            }
          });
        }
      } catch (_error) {
        setStatus("Falha ao buscar configuracao de layout.");
      }
    };

    bootstrap();
  }, [loadChannelState]);

  useEffect(() => {
    loadChannelState(selectedChannel).catch(() => {
      setStatus(`Falha ao atualizar dados do canal ${selectedChannel}.`);
    });
  }, [loadChannelState, selectedChannel]);

  useEffect(() => {
    ensureGoogleFontImport(currentStyle.fontImportUrl);
  }, [currentStyle.fontImportUrl]);

  const handleStyleChange = (field, value) => {
    updateDraft(selectedChannel, (current) => ({
      style: {
        ...current.style,
        [field]: value
      }
    }));
  };

  const handleTextChange = (value) => {
    updateDraft(selectedChannel, {
      texto: value
    });
  };

  const sendUpdate = async ({ target, includeText = true }) => {
    const payload = {
      target,
      estilo: buildStylePayload(currentStyle)
    };

    if (includeText) {
      payload.texto = currentDraft.texto;
    }

    if (socket.connected) {
      socket.emit("lyrics:set", payload, (ack) => {
        if (ack?.ok) {
          setStatus(`Atualizado por WebSocket (destino: ${target}).`);
        }
      });
      return;
    }

    await fetch(`${BACKEND_URL}/letra`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    setStatus(`Atualizado por HTTP (destino: ${target}).`);
  };

  const handleSendSelected = async (event) => {
    event.preventDefault();

    if (
      !(await confirmAction({
        title: "Salvar no canal atual",
        message: `Deseja salvar texto e estilo no canal ${selectedChannel}?`,
        confirmLabel: "Salvar"
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Enviando para canal atual...");

    try {
      await sendUpdate({ target: selectedChannel, includeText: true });
    } catch (_error) {
      setStatus("Falha ao enviar atualizacao para canal atual.");
    }
  };

  const handleSendStyleToAll = async () => {
    if (
      !(await confirmAction({
        title: "Enviar estilo para todos",
        message: "Deseja aplicar o estilo atual em todos os canais?",
        confirmLabel: "Enviar",
        danger: true
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Enviando estilo para todos os canais...");

    try {
      await sendUpdate({ target: "all", includeText: false });
    } catch (_error) {
      setStatus("Falha ao enviar estilo para todos os canais.");
    }
  };

  const handleHolyricsConfigSave = async (event) => {
    event.preventDefault();

    if (
      !(await confirmAction({
        title: "Salvar configuracao Holyrics",
        message: "Deseja salvar as configuracoes do Holyrics?",
        confirmLabel: "Salvar"
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Salvando configuracao Holyrics...");

    try {
      await fetch(`${BACKEND_URL}/holyrics/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...holyricsConfig,
          port: Number(holyricsConfig.port),
          pullIntervalMs: Number(holyricsConfig.pullIntervalMs),
          timeoutMs: Number(holyricsConfig.timeoutMs)
        })
      });

      setStatus("Configuracao Holyrics salva.");
    } catch (_error) {
      setStatus("Falha ao salvar configuracao Holyrics.");
    }
  };

  const triggerHolyricsPull = async () => {
    setStatus("Forcando leitura da API Holyrics...");

    try {
      await fetch(`${BACKEND_URL}/holyrics/pull-now`, {
        method: "POST"
      });
      setStatus("Leitura Holyrics executada.");
      await loadChannelState(selectedChannel);
    } catch (_error) {
      setStatus("Falha ao executar leitura Holyrics.");
    }
  };

  const handleLayoutConfigSave = async (event) => {
    event.preventDefault();

    if (
      !(await confirmAction({
        title: "Salvar layout da musica",
        message: "Deseja salvar a configuracao de layout da musica?",
        confirmLabel: "Salvar"
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Salvando quebra de linha da musica...");

    try {
      await fetch(`${BACKEND_URL}/layout/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          music: {
            breakEveryLines: Number(layoutConfig.music.breakEveryLines)
          }
        })
      });
      setStatus("Layout da musica atualizado.");
      await loadChannelState("music");
    } catch (_error) {
      setStatus("Falha ao salvar configuracao de layout da musica.");
    }
  };

  const applyBibleGradientPreset = async () => {
    if (
      !(await confirmAction({
        title: "Preset da Biblia",
        message: "Deseja aplicar o preset da Biblia no canal Biblia?",
        confirmLabel: "Aplicar"
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setSelectedChannel("bible");
    updateDraft("bible", (current) => ({
      style: {
        ...current.style,
        color: "#ffffff",
        shadowEnabled: true,
        shadowIntensity: 58,
        backgroundMode: "gradient",
        gradientColor: "#121212",
        gradientOpacity: 74,
        gradientSpread: 88,
        gradientDirection: "to top right"
      }
    }));
    setStatus("Preset de Biblia aplicado no canal Biblia.");
  };

  const applyMusicPreset = async () => {
    if (
      !(await confirmAction({
        title: "Preset da Musica",
        message: "Deseja aplicar o preset de Musica no canal Musica?",
        confirmLabel: "Aplicar"
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setSelectedChannel("music");
    updateDraft("music", (current) => ({
      style: {
        ...current.style,
        color: "#fff9df",
        fontSize: 78,
        fontFamily: "Montserrat, sans-serif",
        textAlign: "center",
        shadowEnabled: true,
        shadowIntensity: 74,
        backgroundMode: "gradient",
        gradientColor: "#101f34",
        gradientOpacity: 66,
        gradientSpread: 86,
        gradientDirection: "to top",
        fade: true
      }
    }));
    setStatus("Preset de Musica aplicado no canal Musica.");
  };

  return (
    <main className="app-shell">
      <header className="glass-card hero">
        <div>
          <h1>Painel de Controle</h1>
          <p className="subtitle">Cada canal possui texto e estilo independentes.</p>
        </div>

        <div className="hero-info">
          <span className={`connection-dot ${connected ? "online" : "offline"}`} />
          <span>{connected ? "Conectado" : "Desconectado"}</span>
        </div>

        <div className="channel-switch" role="tablist" aria-label="Canal em edicao">
          {CHANNELS.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className={`channel-button ${selectedChannel === channel.id ? "active" : ""}`}
              onClick={() => setSelectedChannel(channel.id)}
            >
              {channel.label}
            </button>
          ))}
        </div>
      </header>

      <section className="glass-card">
        <h2>Editor de Canal</h2>
        <p className="subtitle">
          Canal em edicao: <strong>{CHANNELS.find((channel) => channel.id === selectedChannel)?.label}</strong>
          {currentDraft.type ? (
            <span className="type-badge" title="Tipo retornado pelo Holyrics">
              {currentDraft.type}
            </span>
          ) : null}
        </p>

        <form onSubmit={handleSendSelected} className="editor-grid">
          <TextareaField
            label="Letra atual"
            fullWidth
            rows={7}
            value={currentDraft.texto}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="Digite aqui a letra em multiplas linhas"
          />

          <div className="style-section field-full">
            <div className="style-section-title">Texto e fonte</div>

            <ColorField
              label="Cor da fonte"
              value={currentStyle.color}
              onChange={(event) => handleStyleChange("color", event.target.value)}
            />

            <NumberField
              label="Tamanho da fonte (px)"
              min={16}
              max={220}
              value={currentStyle.fontSize}
              onChange={(event) => handleStyleChange("fontSize", event.target.value)}
            />

            <SelectField
              label="Fonte"
              value={getFontSelectValue(currentStyle.fontFamily)}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "custom") {
                  return;
                }

                handleStyleChange("fontFamily", nextValue);
              }}
            >
              {FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Fonte personalizada"
              value={getCustomFontInputValue(currentStyle.fontFamily)}
              onChange={(event) => handleStyleChange("fontFamily", event.target.value)}
              placeholder='Ex: "Poppins", sans-serif'
            />

            <TextField
              label="URL do Google Fonts"
              fullWidth
              value={currentStyle.fontImportUrl || ""}
              onChange={(event) => handleStyleChange("fontImportUrl", event.target.value)}
              placeholder='Ex: https://fonts.googleapis.com/css2?family=Bitcount+Prop+Single&display=swap'
            />

            <SelectField
              label="Alinhamento"
              value={currentStyle.textAlign}
              onChange={(event) => handleStyleChange("textAlign", event.target.value)}
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
              onChange={(event) => handleStyleChange("shadowEnabled", event.target.checked)}
            />

            <RangeField
              label={`Intensidade da sombra (${currentStyle.shadowIntensity})`}
              min={0}
              max={100}
              value={currentStyle.shadowIntensity}
              disabled={!currentStyle.shadowEnabled}
              onChange={(event) => handleStyleChange("shadowIntensity", event.target.value)}
            />
          </div>

          <div className="style-section field-full">
            <div className="style-section-title">Background e aparência</div>

            <SelectField
              label="Tipo de background"
              value={currentStyle.backgroundMode}
              onChange={(event) => handleStyleChange("backgroundMode", event.target.value)}
            >
              <option value="transparent">Transparente</option>
              <option value="solid">Cor solida</option>
              <option value="gradient">Gradiente</option>
            </SelectField>

            {currentStyle.backgroundMode === "solid" && (
              <ColorField
                label="Cor do background"
                value={currentStyle.backgroundColor}
                onChange={(event) => handleStyleChange("backgroundColor", event.target.value)}
              />
            )}

            {currentStyle.backgroundMode === "gradient" && (
              <>
                <ColorField
                  label="Cor base do gradiente"
                  value={currentStyle.gradientColor}
                  onChange={(event) => handleStyleChange("gradientColor", event.target.value)}
                />

                <SelectField
                  label="Direcao do gradiente"
                  value={currentStyle.gradientDirection}
                  onChange={(event) => handleStyleChange("gradientDirection", event.target.value)}
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
                  onChange={(event) => handleStyleChange("gradientOpacity", event.target.value)}
                />

                <RangeField
                  label={`Alcance para transparencia (${currentStyle.gradientSpread}%)`}
                  min={15}
                  max={100}
                  value={currentStyle.gradientSpread}
                  onChange={(event) => handleStyleChange("gradientSpread", event.target.value)}
                />
              </>
            )}

            <CheckboxField
              label="Fade suave na troca de letra"
              inline
              checked={currentStyle.fade}
              onChange={(event) => handleStyleChange("fade", event.target.checked)}
            />
          </div>

          {selectedChannel === "bible" && (
            <div className="style-section field-full">
              <div className="style-section-title">Versão e referência bíblica</div>

              <CheckboxField
                label="Mostrar versao da Biblia"
                inline
                checked={currentStyle.showBibleVersion}
                onChange={(event) => handleStyleChange("showBibleVersion", event.target.checked)}
              />

              <SelectField
                label="Posicao da versao"
                value={currentStyle.bibleVersionPosition}
                disabled={!currentStyle.showBibleVersion}
                onChange={(event) => handleStyleChange("bibleVersionPosition", event.target.value)}
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
                onChange={(event) => handleStyleChange("bibleVersionFontSize", event.target.value)}
              />

              <CheckboxField
                label="Mostrar livro/capitulo/versiculo"
                inline
                checked={currentStyle.showBibleReference}
                onChange={(event) => handleStyleChange("showBibleReference", event.target.checked)}
              />

              <SelectField
                label="Posicao da referencia"
                value={currentStyle.bibleReferencePosition}
                disabled={!currentStyle.showBibleReference}
                onChange={(event) => handleStyleChange("bibleReferencePosition", event.target.value)}
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
                onChange={(event) => handleStyleChange("bibleReferenceFontSize", event.target.value)}
              />
            </div>
          )}

          <div className="field field-full action-row">
            <button type="submit">Salvar no canal atual</button>
            <button type="button" className="ghost" onClick={handleSendStyleToAll}>
              Enviar estilo para todos
            </button>
            <button type="button" className="ghost" onClick={applyBibleGradientPreset}>
              Preset Biblia
            </button>
            <button type="button" className="ghost" onClick={applyMusicPreset}>
              Preset Musica
            </button>
          </div>
        </form>

        <div
          className="preview-box"
          style={{
            background: buildPreviewBackground(currentStyle),
            paddingTop: `${previewTopPaddingPx}px`,
            paddingBottom: `${previewBottomPaddingPx}px`
          }}
        >
          <p
            style={{
              color: currentStyle.color,
              fontFamily: currentStyle.fontFamily,
              textAlign: currentStyle.textAlign,
              textShadow: currentStyle.shadowEnabled
                ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 36)}px rgba(0,0,0,0.95)`
                : "none"
            }}
          >
            {currentDraft.texto || "Previa do canal selecionado"}
          </p>

          {showPreviewVersion && (
            <span
              className={`preview-meta preview-version ${toPreviewMetaClass(currentStyle.bibleVersionPosition)}`}
              style={{
                color: currentStyle.color,
                fontFamily: currentStyle.fontFamily,
                fontSize: `${Number(currentStyle.bibleVersionFontSize) || 32}px`,
                ...(isBottomPosition(currentStyle.bibleVersionPosition)
                  ? { bottom: `${12 + previewVersionOffsetPx}px` }
                  : {}),
                textShadow: currentStyle.shadowEnabled
                  ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 20)}px rgba(0,0,0,0.95)`
                  : "none"
              }}
            >
              {currentDraft.bibleInfo?.version || "A Bíblia Sagrada, Almeida Corrigida Fiel | acf"}
            </span>
          )}

          {showPreviewReference && (
            <span
              className={`preview-meta preview-reference ${toPreviewMetaClass(currentStyle.bibleReferencePosition)}`}
              style={{
                color: currentStyle.color,
                fontFamily: currentStyle.fontFamily,
                fontSize: `${Number(currentStyle.bibleReferenceFontSize) || 40}px`,
                ...(isTopPosition(currentStyle.bibleReferencePosition)
                  ? { top: `${12 + previewReferenceOffsetPx}px` }
                  : {}),
                textShadow: currentStyle.shadowEnabled
                  ? `0 0 ${Math.round((Number(currentStyle.shadowIntensity) / 100) * 20)}px rgba(0,0,0,0.95)`
                  : "none"
              }}
            >
              {currentDraft.bibleInfo?.reference || "Gênesis 17:1"}
            </span>
          )}
        </div>
      </section>

      <section className="glass-card compact">
        <h2>Layout Musica</h2>
        <p className="subtitle">Agrupa a musica em blocos de linhas e junta cada bloco em uma linha.</p>

        <form onSubmit={handleLayoutConfigSave} className="inline-form">
          <SelectField
            label="Agrupar musica a cada"
            value={layoutConfig.music.breakEveryLines}
            onChange={(event) =>
              setLayoutConfig((prev) => ({
                ...prev,
                music: {
                  ...prev.music,
                  breakEveryLines: Number(event.target.value)
                }
              }))
            }
          >
            <option value={0}>Desativado</option>
            <option value={2}>2 linhas</option>
            <option value={3}>3 linhas</option>
            <option value={4}>4 linhas</option>
            <option value={5}>5 linhas</option>
          </SelectField>

          <button type="submit">Salvar layout da musica</button>
        </form>
      </section>

      <section className="glass-card compact" style={{
    position: 'relative',
    zIndex: 1,
  }}>
        <h2>Integracao Holyrics</h2>
        <p className="subtitle">Configure IP, porta, token e modo de leitura da API.</p>

        <form onSubmit={handleHolyricsConfigSave} className="editor-grid">
          <TextField
            label="IP / Host"
            value={holyricsConfig.host}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, host: event.target.value }))}
          />

          <NumberField
            label="Porta"
            value={holyricsConfig.port}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, port: event.target.value }))}
          />

          <TextField
            label="Path da API"
            fullWidth
            value={holyricsConfig.path}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, path: event.target.value }))}
          />

          <SelectField
            label="Metodo HTTP"
            value={holyricsConfig.method}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, method: event.target.value }))}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </SelectField>

          <TextField
            label="Token"
            value={holyricsConfig.token}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, token: event.target.value }))}
          />

          <TextField
            label="Header do token"
            value={holyricsConfig.tokenHeader}
            onChange={(event) =>
              setHolyricsConfig((prev) => ({ ...prev, tokenHeader: event.target.value }))
            }
            placeholder="Authorization"
          />

          <TextField
            label="Campo do texto (path)"
            value={holyricsConfig.textPath}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, textPath: event.target.value }))}
            placeholder="Ex: map.text"
          />

          <NumberField
            label="Intervalo do pull (ms)"
            min={100}
            max={5000}
            value={holyricsConfig.pullIntervalMs}
            onChange={(event) =>
              setHolyricsConfig((prev) => ({ ...prev, pullIntervalMs: event.target.value }))
            }
          />

          <NumberField
            label="Timeout HTTP (ms)"
            min={500}
            max={6000}
            value={holyricsConfig.timeoutMs}
            onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, timeoutMs: event.target.value }))}
          />

          <CheckboxField
            label="Ativar leitura automatica (pull)"
            inline
            fullWidth
            checked={holyricsConfig.pullEnabled}
            onChange={(event) =>
              setHolyricsConfig((prev) => ({ ...prev, pullEnabled: event.target.checked }))
            }
          />

          <div className="field field-full action-row">
            <button type="submit">Salvar configuracao Holyrics</button>
            <button type="button" className="ghost" onClick={triggerHolyricsPull}>
              Ler agora da API Holyrics
            </button>
          </div>
        </form>
      </section>

      <footer className="glass-card footer-card">
        <p className="status">Status: {status}</p>
        <p className="tips">
          Browser Input Default: <code>{BACKEND_URL}/display</code>
        </p>
        <p className="tips">
          Browser Input Musica: <code>{BACKEND_URL}/display/music</code>
        </p>
        <p className="tips">
          Browser Input Biblia: <code>{BACKEND_URL}/display/bible</code>
        </p>
      </footer>

      {confirmDialog.open && (
        <div className="confirm-backdrop" role="presentation" onClick={() => closeConfirmDialog(false)}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-title">{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button type="button" className="ghost" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                className={confirmDialog.danger ? "danger" : ""}
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
