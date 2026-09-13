import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { CHANNELS } from "./constants/channels";
import {
  createEmptyDraft,
  createInitialDrafts,
  initialHolyricsConfig,
  initialLayoutConfig,
} from "./constants/defaults";
import ChannelEditor from "./components/ChannelEditor";
import ConfirmDialog from "./components/ConfirmDialog";
import HolyricsConfigForm from "./components/HolyricsConfigForm";
import HolyricsDiagnostics from "./components/HolyricsDiagnostics";
import MusicLayoutForm from "./components/MusicLayoutForm";
import PresetManager from "./components/PresetManager";
import VMixUrls from "./components/VMixUrls";
import { parseBibleInfo, parseType } from "./utils/bibleInfo";
import { fetchJson } from "./utils/fetchJson";
import { buildStylePayload, ensureGoogleFontImport, parseServerStyle } from "./utils/style";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const initialDiagnostics = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastUrl: null,
  lastTextLength: 0,
  lastResponsePreview: null,
  lastType: null,
  lastChannel: null,
};

function App() {
  const [selectedChannel, setSelectedChannel] = useState("default");
  const [channelDrafts, setChannelDrafts] = useState(createInitialDrafts);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [holyricsConfig, setHolyricsConfig] = useState(initialHolyricsConfig);
  const [layoutConfig, setLayoutConfig] = useState(initialLayoutConfig);
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const [presets, setPresets] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    danger: false,
  });
  const confirmResolverRef = useRef(null);
  const socketRef = useRef(null);

  const currentDraft = channelDrafts[selectedChannel] || createEmptyDraft();
  const currentStyle = currentDraft.style;

  const closeConfirmDialog = useCallback((result) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }

    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  // Guarded against re-entrancy: if a confirm dialog is already open and
  // something tries to open a second one, the first Promise would otherwise
  // never resolve. Now used sparingly - only for the one genuinely
  // destructive/broad action (pushing style to every channel at once).
  const confirmAction = useCallback(
    ({
      title = "Confirmar acao",
      message = "Deseja continuar?",
      confirmLabel = "Confirmar",
      cancelLabel = "Cancelar",
      danger = false,
    }) => {
      if (confirmResolverRef.current) {
        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        confirmResolverRef.current = resolve;
        setConfirmDialog({
          open: true,
          title,
          message,
          confirmLabel,
          cancelLabel,
          danger,
        });
      });
    },
    []
  );

  const updateDraft = useCallback((channel, updater) => {
    setChannelDrafts((prev) => {
      const current = prev[channel] || createEmptyDraft();
      const nextPartial = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [channel]: {
          ...current,
          ...nextPartial,
          style: {
            ...current.style,
            ...(nextPartial?.style || {}),
          },
          bibleInfo: {
            ...current.bibleInfo,
            ...(nextPartial?.bibleInfo || {}),
          },
        },
      };
    });
  }, []);

  const loadChannelState = useCallback(
    async (channel) => {
      const data = await fetchJson(`${BACKEND_URL}/estado?channel=${channel}`);

      updateDraft(channel, (current) => ({
        texto: typeof data?.texto === "string" ? data.texto : current.texto,
        style: data?.estilo ? parseServerStyle(data.estilo) : current.style,
        bibleInfo: parseBibleInfo(data?.meta?.bibleInfo),
        type: parseType(data?.meta?.type),
      }));
    },
    [updateDraft]
  );

  // Socket lifecycle lives in a proper effect (not useMemo, which isn't
  // meant to host side effects like opening a network connection and isn't
  // guaranteed to run only once). The connection is still re-established
  // per channel switch to match how the backend currently reads the
  // `channel` query param at handshake time - if the backend gains a
  // `channel:subscribe` event, this can become a single persistent socket
  // instead of a reconnect per switch.
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket"],
      query: { channel: selectedChannel },
    });
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onUpdate = (payload) => {
      updateDraft(selectedChannel, (current) => ({
        texto: typeof payload?.texto === "string" ? payload.texto : current.texto,
        style: payload?.estilo ? parseServerStyle(payload.estilo) : current.style,
        bibleInfo: parseBibleInfo(payload?.meta?.bibleInfo),
        type: parseType(payload?.meta?.type),
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
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [selectedChannel, updateDraft]);

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
      const results = await Promise.allSettled(
        CHANNELS.map((channel) => loadChannelState(channel.id))
      );
      const failedChannels = results
        .map((result, index) => (result.status === "rejected" ? CHANNELS[index].label : null))
        .filter(Boolean);

      if (failedChannels.length) {
        setStatus(`Falha ao buscar estado de: ${failedChannels.join(", ")}.`);
      }

      try {
        const data = await fetchJson(`${BACKEND_URL}/holyrics/config`);
        if (data?.config) {
          setHolyricsConfig({
            ...initialHolyricsConfig,
            ...data.config,
          });
        }
      } catch (_error) {
        setStatus("Falha ao buscar configuracao do Holyrics.");
      }

      try {
        const data = await fetchJson(`${BACKEND_URL}/layout/config`);
        if (data?.config) {
          setLayoutConfig({
            ...initialLayoutConfig,
            ...data.config,
            music: {
              ...initialLayoutConfig.music,
              ...(data.config.music || {}),
            },
          });
        }
      } catch (_error) {
        setStatus("Falha ao buscar configuracao de layout.");
      }

      try {
        const data = await fetchJson(`${BACKEND_URL}/holyrics/diagnostics`);
        if (data?.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
      } catch (_error) {
        setStatus("Falha ao buscar diagnostico do Holyrics.");
      }

      try {
        const data = await fetchJson(`${BACKEND_URL}/runtime-config/status`);
        if (data?.warning) {
          setStatus(data.warning);
        }
      } catch (_error) {
        // status de configuracao e informativo - falha aqui nao deve
        // sobrescrever mensagens de status mais relevantes do bootstrap
      }

      try {
        const data = await fetchJson(`${BACKEND_URL}/presets`);
        if (Array.isArray(data?.presets)) {
          setPresets(data.presets);
        }
      } catch (_error) {
        setStatus("Falha ao buscar presets salvos.");
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
        [field]: value,
      },
    }));
  };

  const handleTextChange = (value) => {
    updateDraft(selectedChannel, {
      texto: value,
    });
  };

  const sendUpdate = async ({
    target,
    includeText = true,
    texto = currentDraft.texto,
    styleOverride = {},
  }) => {
    const payload = {
      target,
      estilo: buildStylePayload({ ...currentStyle, ...styleOverride }),
    };

    if (includeText) {
      payload.texto = texto;
    }

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("lyrics:set", payload, (ack) => {
        if (ack?.ok) {
          setStatus(`Atualizado por WebSocket (destino: ${target}).`);
        } else {
          setStatus(`Servidor rejeitou a atualizacao (destino: ${target}).`);
        }
      });
      return;
    }

    await fetchJson(`${BACKEND_URL}/letra`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    setStatus(`Atualizado por HTTP (destino: ${target}).`);
  };

  const handleSendSelected = async (event) => {
    event.preventDefault();
    setStatus("Enviando para canal atual...");

    try {
      await sendUpdate({ target: selectedChannel, includeText: true });
    } catch (error) {
      setStatus(`Falha ao enviar atualizacao para canal atual: ${error.message}`);
    }
  };

  const handleSendStyleToAll = async () => {
    if (
      !(await confirmAction({
        title: "Enviar estilo para todos",
        message: "Deseja aplicar o estilo atual em todos os canais?",
        confirmLabel: "Enviar",
        danger: true,
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Enviando estilo para todos os canais...");

    try {
      await sendUpdate({ target: "all", includeText: false });
    } catch (error) {
      setStatus(`Falha ao enviar estilo para todos os canais: ${error.message}`);
    }
  };

  const handleClearChannel = async () => {
    setStatus(`Limpando canal ${selectedChannel}...`);

    try {
      await sendUpdate({ target: selectedChannel, includeText: true, texto: "" });
      updateDraft(selectedChannel, { texto: "" });
      setStatus(`Canal ${selectedChannel} limpo.`);
    } catch (error) {
      setStatus(`Falha ao limpar canal atual: ${error.message}`);
    }
  };

  const handleToggleVisible = async () => {
    const nextVisible = !currentStyle.visible;
    setStatus(nextVisible ? "Exibindo canal..." : "Ocultando canal...");
    updateDraft(selectedChannel, (current) => ({
      style: { ...current.style, visible: nextVisible },
    }));

    try {
      await sendUpdate({
        target: selectedChannel,
        includeText: false,
        styleOverride: { visible: nextVisible },
      });
      setStatus(nextVisible ? "Canal visivel novamente." : "Canal oculto (texto preservado).");
    } catch (error) {
      setStatus(`Falha ao alterar visibilidade do canal: ${error.message}`);
    }
  };

  const handleHolyricsConfigFieldChange = (field, value) => {
    setHolyricsConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleHolyricsConfigSave = async (event) => {
    event.preventDefault();
    setStatus("Salvando configuracao Holyrics...");

    try {
      await fetchJson(`${BACKEND_URL}/holyrics/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...holyricsConfig,
          port: Number(holyricsConfig.port),
          pullIntervalMs: Number(holyricsConfig.pullIntervalMs),
          timeoutMs: Number(holyricsConfig.timeoutMs),
        }),
      });

      setStatus("Configuracao Holyrics salva.");
    } catch (error) {
      setStatus(`Falha ao salvar configuracao Holyrics: ${error.message}`);
    }
  };

  const handleResetRuntimeConfig = async () => {
    if (
      !(await confirmAction({
        title: "Restaurar configuracao padrao",
        message:
          "Isso substitui estilos, layout e configuracao do Holyrics pelos valores padrao em todos os canais. Deseja continuar?",
        confirmLabel: "Restaurar",
        danger: true,
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Restaurando configuracao padrao...");

    try {
      await fetchJson(`${BACKEND_URL}/runtime-config/reset`, { method: "POST" });
      await Promise.all(CHANNELS.map((channel) => loadChannelState(channel.id)));

      const holyricsData = await fetchJson(`${BACKEND_URL}/holyrics/config`);
      if (holyricsData?.config) {
        setHolyricsConfig({ ...initialHolyricsConfig, ...holyricsData.config });
      }

      const layoutData = await fetchJson(`${BACKEND_URL}/layout/config`);
      if (layoutData?.config) {
        setLayoutConfig({
          ...initialLayoutConfig,
          ...layoutData.config,
          music: { ...initialLayoutConfig.music, ...(layoutData.config.music || {}) },
        });
      }

      setStatus("Configuracao restaurada para os valores padrao.");
    } catch (error) {
      setStatus(`Falha ao restaurar configuracao padrao: ${error.message}`);
    }
  };

  const refreshDiagnostics = async () => {
    try {
      const data = await fetchJson(`${BACKEND_URL}/holyrics/diagnostics`);
      if (data?.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch (error) {
      setStatus(`Falha ao atualizar diagnostico: ${error.message}`);
    }
  };

  const triggerHolyricsPull = async () => {
    setStatus("Forcando leitura da API Holyrics...");

    try {
      const data = await fetchJson(`${BACKEND_URL}/holyrics/pull-now`, {
        method: "POST",
      });
      if (data?.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
      setStatus("Leitura Holyrics executada.");
      await loadChannelState(selectedChannel);
    } catch (error) {
      setStatus(`Falha ao executar leitura Holyrics: ${error.message}`);
    }
  };

  const handleBreakEveryLinesChange = (breakEveryLines) => {
    setLayoutConfig((prev) => ({
      ...prev,
      music: {
        ...prev.music,
        breakEveryLines,
      },
    }));
  };

  const handleLayoutConfigSave = async (event) => {
    event.preventDefault();
    setStatus("Salvando quebra de linha da musica...");

    try {
      await fetchJson(`${BACKEND_URL}/layout/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          music: {
            breakEveryLines: Number(layoutConfig.music.breakEveryLines),
          },
        }),
      });
      setStatus("Layout da musica atualizado.");
      await loadChannelState("music");
    } catch (error) {
      setStatus(`Falha ao salvar configuracao de layout da musica: ${error.message}`);
    }
  };

  const applyBibleGradientPreset = () => {
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
        gradientDirection: "to top right",
      },
    }));
    setStatus("Preset de Biblia aplicado no canal Biblia.");
  };

  const applyMusicPreset = () => {
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
        fade: true,
      },
    }));
    setStatus("Preset de Musica aplicado no canal Musica.");
  };

  const handleSavePreset = async (name) => {
    setStatus(`Salvando preset "${name}"...`);

    try {
      const data = await fetchJson(`${BACKEND_URL}/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, style: buildStylePayload(currentStyle) }),
      });

      if (data?.preset) {
        setPresets((prev) => [...prev, data.preset]);
      }
      setStatus(`Preset "${name}" salvo.`);
    } catch (error) {
      setStatus(`Falha ao salvar preset: ${error.message}`);
    }
  };

  const handleRenamePreset = async (id, name) => {
    setStatus(`Renomeando preset...`);

    try {
      const data = await fetchJson(`${BACKEND_URL}/presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (data?.preset) {
        setPresets((prev) => prev.map((preset) => (preset.id === id ? data.preset : preset)));
      }
      setStatus(`Preset renomeado para "${name}".`);
    } catch (error) {
      setStatus(`Falha ao renomear preset: ${error.message}`);
    }
  };

  const handleDeletePreset = async (id) => {
    const preset = presets.find((item) => item.id === id);

    if (
      !(await confirmAction({
        title: "Excluir preset",
        message: `Deseja excluir o preset "${preset?.name || id}"?`,
        confirmLabel: "Excluir",
        danger: true,
      }))
    ) {
      setStatus("Operacao cancelada.");
      return;
    }

    setStatus("Excluindo preset...");

    try {
      await fetchJson(`${BACKEND_URL}/presets/${id}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((item) => item.id !== id));
      setStatus("Preset excluido.");
    } catch (error) {
      setStatus(`Falha ao excluir preset: ${error.message}`);
    }
  };

  const handleApplyPreset = async (id) => {
    setStatus("Aplicando preset no canal atual...");

    try {
      await fetchJson(`${BACKEND_URL}/presets/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: selectedChannel }),
      });
      await loadChannelState(selectedChannel);
      setStatus("Preset aplicado no canal atual.");
    } catch (error) {
      setStatus(`Falha ao aplicar preset: ${error.message}`);
    }
  };

  const handleExportPresets = () => {
    const blob = new Blob([JSON.stringify({ presets }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "holyrics-vmix-presets.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Presets exportados.");
  };

  const handleImportPresetsFile = async (file) => {
    setStatus("Importando presets...");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incomingPresets = Array.isArray(parsed) ? parsed : parsed?.presets;

      if (!Array.isArray(incomingPresets)) {
        throw new Error("Arquivo deve conter uma lista de presets (ou { presets: [...] }).");
      }

      const data = await fetchJson(`${BACKEND_URL}/presets/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presets: incomingPresets }),
      });

      if (Array.isArray(data?.imported) && data.imported.length > 0) {
        setPresets((prev) => [...prev, ...data.imported]);
      }

      const errorCount = data?.errors?.length || 0;
      setStatus(
        errorCount > 0
          ? `${data.imported.length} preset(s) importado(s), ${errorCount} invalido(s).`
          : `${data.imported.length} preset(s) importado(s) com sucesso.`
      );
    } catch (error) {
      setStatus(`Falha ao importar presets: ${error.message}`);
    }
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
          {CHANNELS.map((channel) => {
            const draft = channelDrafts[channel.id];
            const hasText = Boolean(draft?.texto?.trim());
            const isHidden = draft?.style?.visible === false;

            return (
              <button
                key={channel.id}
                type="button"
                className={`channel-button ${selectedChannel === channel.id ? "active" : ""}`}
                onClick={() => setSelectedChannel(channel.id)}
              >
                <span
                  className={`channel-status-dot ${hasText ? "has-text" : ""} ${isHidden ? "hidden" : ""}`}
                  title={isHidden ? "Canal oculto" : hasText ? "Canal com texto" : "Canal vazio"}
                  aria-hidden="true"
                />
                {channel.label}
              </button>
            );
          })}
        </div>
      </header>

      <ChannelEditor
        selectedChannel={selectedChannel}
        currentDraft={currentDraft}
        currentStyle={currentStyle}
        onTextChange={handleTextChange}
        onStyleChange={handleStyleChange}
        onSubmit={handleSendSelected}
        onSendStyleToAll={handleSendStyleToAll}
        onApplyBiblePreset={applyBibleGradientPreset}
        onApplyMusicPreset={applyMusicPreset}
        onClearChannel={handleClearChannel}
        onToggleVisible={handleToggleVisible}
      />

      <PresetManager
        presets={presets}
        onSave={handleSavePreset}
        onRename={handleRenamePreset}
        onApply={handleApplyPreset}
        onDelete={handleDeletePreset}
        onExport={handleExportPresets}
        onImportFile={handleImportPresetsFile}
      />

      <MusicLayoutForm
        layoutConfig={layoutConfig}
        onBreakEveryLinesChange={handleBreakEveryLinesChange}
        onSubmit={handleLayoutConfigSave}
      />

      <HolyricsConfigForm
        holyricsConfig={holyricsConfig}
        onFieldChange={handleHolyricsConfigFieldChange}
        onSubmit={handleHolyricsConfigSave}
        onPullNow={triggerHolyricsPull}
      />

      <HolyricsDiagnostics
        diagnostics={diagnostics}
        onRefresh={refreshDiagnostics}
        onResetDefaults={handleResetRuntimeConfig}
      />

      <footer className="glass-card footer-card">
        <p className="status">Status: {status}</p>
        <VMixUrls backendUrl={BACKEND_URL} />
      </footer>

      <ConfirmDialog
        dialog={confirmDialog}
        onCancel={() => closeConfirmDialog(false)}
        onConfirm={() => closeConfirmDialog(true)}
      />
    </main>
  );
}

export default App;
