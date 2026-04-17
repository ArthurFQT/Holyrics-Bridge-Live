import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const CHANNELS = [
  { id: "default", label: "Default" },
  { id: "music", label: "Musica" },
  { id: "bible", label: "Biblia" }
];

const initialStyle = {
  color: "#ffffff",
  fontSize: 72,
  fontFamily: "Montserrat, sans-serif",
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
      style: { ...initialStyle }
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
    shadowEnabled: style.shadowEnabled ?? style.textShadow !== "none"
  };
};

const buildStylePayload = (style) => ({
  color: style.color,
  fontSize: Number(style.fontSize),
  fontFamily: style.fontFamily,
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
  fade: style.fade
});

const buildPreviewBackground = (style) => {
  if (style.backgroundMode === "solid") {
    return style.backgroundColor;
  }

  if (style.backgroundMode === "gradient") {
    return `linear-gradient(${style.gradientDirection}, ${style.gradientColor} 0%, transparent ${style.gradientSpread}%)`;
  }

  return "linear-gradient(140deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 100%)";
};

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

  const currentDraft = channelDrafts[selectedChannel] || { texto: "", style: initialStyle };
  const currentStyle = currentDraft.style;

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
      const current = prev[channel] || { texto: "", style: { ...initialStyle } };
      const nextPartial = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [channel]: {
          ...current,
          ...nextPartial,
          style: {
            ...current.style,
            ...(nextPartial?.style || {})
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
        style: data?.estilo ? parseServerStyle(data.estilo) : current.style
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
        style: payload?.estilo ? parseServerStyle(payload.estilo) : current.style
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
        </p>

        <form onSubmit={handleSendSelected} className="editor-grid">
          <label className="field field-full">
            Letra atual
            <textarea
              rows={7}
              value={currentDraft.texto}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder="Digite aqui a letra em multiplas linhas"
            />
          </label>

          <label className="field">
            Cor da fonte
            <input
              type="color"
              value={currentStyle.color}
              onChange={(event) => handleStyleChange("color", event.target.value)}
            />
          </label>

          <label className="field">
            Tamanho da fonte (px)
            <input
              type="number"
              min={16}
              max={220}
              value={currentStyle.fontSize}
              onChange={(event) => handleStyleChange("fontSize", event.target.value)}
            />
          </label>

          <label className="field">
            Fonte
            <input
              type="text"
              value={currentStyle.fontFamily}
              onChange={(event) => handleStyleChange("fontFamily", event.target.value)}
              placeholder="Ex: Montserrat, sans-serif"
            />
          </label>

          <label className="field">
            Alinhamento
            <select
              value={currentStyle.textAlign}
              onChange={(event) => handleStyleChange("textAlign", event.target.value)}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
              <option value="justify">Justificado</option>
            </select>
          </label>

          <label className="field inline">
            <input
              type="checkbox"
              checked={currentStyle.shadowEnabled}
              onChange={(event) => handleStyleChange("shadowEnabled", event.target.checked)}
            />
            Sombra ativada
          </label>

          <label className="field">
            Intensidade da sombra ({currentStyle.shadowIntensity})
            <input
              type="range"
              min={0}
              max={100}
              value={currentStyle.shadowIntensity}
              disabled={!currentStyle.shadowEnabled}
              onChange={(event) => handleStyleChange("shadowIntensity", event.target.value)}
            />
          </label>

          <label className="field">
            Tipo de background
            <select
              value={currentStyle.backgroundMode}
              onChange={(event) => handleStyleChange("backgroundMode", event.target.value)}
            >
              <option value="transparent">Transparente</option>
              <option value="solid">Cor solida</option>
              <option value="gradient">Gradiente</option>
            </select>
          </label>

          {currentStyle.backgroundMode === "solid" && (
            <label className="field">
              Cor do background
              <input
                type="color"
                value={currentStyle.backgroundColor}
                onChange={(event) => handleStyleChange("backgroundColor", event.target.value)}
              />
            </label>
          )}

          {currentStyle.backgroundMode === "gradient" && (
            <>
              <label className="field">
                Cor base do gradiente
                <input
                  type="color"
                  value={currentStyle.gradientColor}
                  onChange={(event) => handleStyleChange("gradientColor", event.target.value)}
                />
              </label>

              <label className="field">
                Direcao do gradiente
                <select
                  value={currentStyle.gradientDirection}
                  onChange={(event) => handleStyleChange("gradientDirection", event.target.value)}
                >
                  <option value="to top right">Canto inferior esquerdo para topo direito</option>
                  <option value="to top left">Canto inferior direito para topo esquerdo</option>
                  <option value="to top">Baixo para cima</option>
                  <option value="to right">Esquerda para direita</option>
                  <option value="to left">Direita para esquerda</option>
                  <option value="to bottom">Cima para baixo</option>
                </select>
              </label>

              <label className="field">
                Opacidade inicial ({currentStyle.gradientOpacity}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={currentStyle.gradientOpacity}
                  onChange={(event) => handleStyleChange("gradientOpacity", event.target.value)}
                />
              </label>

              <label className="field">
                Alcance para transparencia ({currentStyle.gradientSpread}%)
                <input
                  type="range"
                  min={15}
                  max={100}
                  value={currentStyle.gradientSpread}
                  onChange={(event) => handleStyleChange("gradientSpread", event.target.value)}
                />
              </label>
            </>
          )}

          <label className="field inline">
            <input
              type="checkbox"
              checked={currentStyle.fade}
              onChange={(event) => handleStyleChange("fade", event.target.checked)}
            />
            Fade suave na troca de letra
          </label>

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

        <div className="preview-box" style={{ background: buildPreviewBackground(currentStyle) }}>
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
        </div>
      </section>

      <section className="glass-card compact">
        <h2>Layout Musica</h2>
        <p className="subtitle">Agrupa a musica em blocos de linhas e junta cada bloco em uma linha.</p>

        <form onSubmit={handleLayoutConfigSave} className="inline-form">
          <label className="field">
            Agrupar musica a cada
            <select
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
            </select>
          </label>

          <button type="submit">Salvar layout da musica</button>
        </form>
      </section>

      <section className="glass-card compact">
        <h2>Integracao Holyrics</h2>
        <p className="subtitle">Configure IP, porta, token e modo de leitura da API.</p>

        <form onSubmit={handleHolyricsConfigSave} className="editor-grid">
          <label className="field">
            IP / Host
            <input
              type="text"
              value={holyricsConfig.host}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, host: event.target.value }))}
            />
          </label>

          <label className="field">
            Porta
            <input
              type="number"
              value={holyricsConfig.port}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, port: event.target.value }))}
            />
          </label>

          <label className="field field-full">
            Path da API
            <input
              type="text"
              value={holyricsConfig.path}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, path: event.target.value }))}
            />
          </label>

          <label className="field">
            Metodo HTTP
            <select
              value={holyricsConfig.method}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, method: event.target.value }))}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>

          <label className="field">
            Token
            <input
              type="text"
              value={holyricsConfig.token}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, token: event.target.value }))}
            />
          </label>

          <label className="field">
            Header do token
            <input
              type="text"
              value={holyricsConfig.tokenHeader}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, tokenHeader: event.target.value }))
              }
              placeholder="Authorization"
            />
          </label>

          <label className="field">
            Campo do texto (path)
            <input
              type="text"
              value={holyricsConfig.textPath}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, textPath: event.target.value }))}
              placeholder="Ex: map.text"
            />
          </label>

          <label className="field">
            Intervalo do pull (ms)
            <input
              type="number"
              min={100}
              max={5000}
              value={holyricsConfig.pullIntervalMs}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, pullIntervalMs: event.target.value }))
              }
            />
          </label>

          <label className="field">
            Timeout HTTP (ms)
            <input
              type="number"
              min={500}
              max={6000}
              value={holyricsConfig.timeoutMs}
              onChange={(event) => setHolyricsConfig((prev) => ({ ...prev, timeoutMs: event.target.value }))}
            />
          </label>

          <label className="field inline field-full">
            <input
              type="checkbox"
              checked={holyricsConfig.pullEnabled}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, pullEnabled: event.target.checked }))
              }
            />
            Ativar leitura automatica (pull)
          </label>

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
