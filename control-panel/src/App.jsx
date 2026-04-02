import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const initialStyle = {
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

function App() {
  const [texto, setTexto] = useState("");
  const [style, setStyle] = useState(initialStyle);
  const [target, setTarget] = useState("default");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Pronto");
  const [holyricsConfig, setHolyricsConfig] = useState(initialHolyricsConfig);
  const [layoutConfig, setLayoutConfig] = useState(initialLayoutConfig);

  const socket = useMemo(
    () =>
      io(BACKEND_URL, {
        transports: ["websocket"],
        query: { channel: "default" }
      }),
    []
  );

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onUpdate = (payload) => {
      if (typeof payload?.texto === "string") {
        setTexto(payload.texto);
      }

      if (payload?.estilo) {
        setStyle(parseServerStyle(payload.estilo));
      }
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
  }, [socket]);

  useEffect(() => {
    const loadHolyricsConfig = async () => {
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
    };

    loadHolyricsConfig();
  }, []);

  useEffect(() => {
    const loadLayoutConfig = async () => {
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

    loadLayoutConfig();
  }, []);

  const handleStyleChange = (field, value) => {
    setStyle((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const sendPayload = () => ({
    texto,
    target,
    estilo: {
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
    }
  });

  const handleSend = async (event) => {
    event.preventDefault();
    setStatus("Enviando...");

    const payload = sendPayload();

    if (socket.connected) {
      socket.emit("lyrics:set", payload, (ack) => {
        if (ack?.ok) {
          setStatus(`Atualizado por WebSocket (destino: ${target}).`);
        }
      });

      return;
    }

    try {
      await fetch(`${BACKEND_URL}/letra`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      setStatus(`Atualizado por HTTP (destino: ${target}).`);
    } catch (_error) {
      setStatus("Falha ao enviar atualizacao.");
    }
  };

  const handleHolyricsConfigSave = async (event) => {
    event.preventDefault();
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
    } catch (_error) {
      setStatus("Falha ao executar leitura Holyrics.");
    }
  };

  const handleLayoutConfigSave = async (event) => {
    event.preventDefault();
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
      setStatus("Quebra de linha da musica atualizada.");
    } catch (_error) {
      setStatus("Falha ao salvar quebra de linha da musica.");
    }
  };

  const applyBibleGradientPreset = () => {
    setTarget("bible");
    setStyle((prev) => ({
      ...prev,
      color: "#ffffff",
      shadowEnabled: true,
      shadowIntensity: 58,
      backgroundMode: "gradient",
      gradientColor: "#121212",
      gradientOpacity: 74,
      gradientSpread: 88,
      gradientDirection: "to top right"
    }));
    setStatus("Preset de Biblia aplicado (gradiente do canto inferior esquerdo).");
  };

  return (
    <main className="container">
      <section className="card">
        <h1>Painel de Controle de Letras</h1>
        <p className="subtitle">Conectado ao backend: {connected ? "sim" : "nao"}</p>

        <form onSubmit={handleSend} className="form-grid">
          <label>
            Destino do envio
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="default">Default (monitor geral)</option>
              <option value="music">Somente Musica</option>
              <option value="bible">Somente Biblia</option>
              <option value="all">Todos os canais</option>
            </select>
          </label>

          <label>
            Letra atual
            <textarea
              rows={6}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Digite aqui a letra em multiplas linhas"
            />
          </label>

          <label>
            Cor da fonte
            <input
              type="color"
              value={style.color}
              onChange={(event) => handleStyleChange("color", event.target.value)}
            />
          </label>

          <label>
            Tamanho da fonte (px)
            <input
              type="number"
              min={16}
              max={220}
              value={style.fontSize}
              onChange={(event) => handleStyleChange("fontSize", event.target.value)}
            />
          </label>

          <label>
            Fonte
            <input
              type="text"
              value={style.fontFamily}
              onChange={(event) => handleStyleChange("fontFamily", event.target.value)}
              placeholder="Ex: Montserrat, sans-serif"
            />
          </label>

          <label>
            Alinhamento
            <select
              value={style.textAlign}
              onChange={(event) => handleStyleChange("textAlign", event.target.value)}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
              <option value="justify">Justificado</option>
            </select>
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={style.shadowEnabled}
              onChange={(event) => handleStyleChange("shadowEnabled", event.target.checked)}
            />
            Sombra ativada
          </label>

          <label>
            Intensidade da sombra ({style.shadowIntensity})
            <input
              type="range"
              min={0}
              max={100}
              value={style.shadowIntensity}
              disabled={!style.shadowEnabled}
              onChange={(event) => handleStyleChange("shadowIntensity", event.target.value)}
            />
          </label>

          <label>
            Tipo de background
            <select
              value={style.backgroundMode}
              onChange={(event) => handleStyleChange("backgroundMode", event.target.value)}
            >
              <option value="transparent">Transparente</option>
              <option value="solid">Cor solida</option>
              <option value="gradient">Gradiente</option>
            </select>
          </label>

          {style.backgroundMode === "solid" && (
            <label>
              Cor do background
              <input
                type="color"
                value={style.backgroundColor}
                onChange={(event) => handleStyleChange("backgroundColor", event.target.value)}
              />
            </label>
          )}

          {style.backgroundMode === "gradient" && (
            <>
              <label>
                Cor base do gradiente
                <input
                  type="color"
                  value={style.gradientColor}
                  onChange={(event) => handleStyleChange("gradientColor", event.target.value)}
                />
              </label>

              <label>
                Direcao do gradiente
                <select
                  value={style.gradientDirection}
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

              <label>
                Opacidade inicial ({style.gradientOpacity}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={style.gradientOpacity}
                  onChange={(event) => handleStyleChange("gradientOpacity", event.target.value)}
                />
              </label>

              <label>
                Alcance para transparencia ({style.gradientSpread}%)
                <input
                  type="range"
                  min={15}
                  max={100}
                  value={style.gradientSpread}
                  onChange={(event) => handleStyleChange("gradientSpread", event.target.value)}
                />
              </label>
            </>
          )}

          <label className="inline">
            <input
              type="checkbox"
              checked={style.fade}
              onChange={(event) => handleStyleChange("fade", event.target.checked)}
            />
            Fade suave na troca de letra
          </label>

          <button type="submit">Enviar</button>
          <button type="button" className="secondary" onClick={applyBibleGradientPreset}>
            Preset Biblia (gradiente canto inferior esquerdo)
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Layout Musica</h2>
        <p className="subtitle">
          Define quantas linhas da musica ficam em cada bloco antes de inserir uma linha em branco.
        </p>

        <form onSubmit={handleLayoutConfigSave} className="form-grid">
          <label>
            Quebrar musica a cada
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

          <button type="submit">Salvar quebra de linha da musica</button>
        </form>
      </section>

      <section className="card">
        <h2>Integracao Holyrics</h2>
        <p className="subtitle">Configure IP, porta, token e modo de leitura da API.</p>

        <form onSubmit={handleHolyricsConfigSave} className="form-grid">
          <label>
            IP / Host
            <input
              type="text"
              value={holyricsConfig.host}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, host: event.target.value }))
              }
            />
          </label>

          <label>
            Porta
            <input
              type="number"
              value={holyricsConfig.port}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, port: event.target.value }))
              }
            />
          </label>

          <label>
            Path da API
            <input
              type="text"
              value={holyricsConfig.path}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, path: event.target.value }))
              }
            />
          </label>

          <label>
            Metodo HTTP
            <select
              value={holyricsConfig.method}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, method: event.target.value }))
              }
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>

          <label>
            Token
            <input
              type="text"
              value={holyricsConfig.token}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, token: event.target.value }))
              }
            />
          </label>

          <label>
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

          <label>
            Campo do texto (path)
            <input
              type="text"
              value={holyricsConfig.textPath}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, textPath: event.target.value }))
              }
              placeholder="ex: map.text"
            />
          </label>

          <label>
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

          <label>
            Timeout HTTP (ms)
            <input
              type="number"
              min={500}
              max={6000}
              value={holyricsConfig.timeoutMs}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, timeoutMs: event.target.value }))
              }
            />
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={holyricsConfig.pullEnabled}
              onChange={(event) =>
                setHolyricsConfig((prev) => ({ ...prev, pullEnabled: event.target.checked }))
              }
            />
            Ativar leitura automatica (pull)
          </label>

          <button type="submit">Salvar configuracao Holyrics</button>
        </form>

        <button type="button" className="secondary" onClick={triggerHolyricsPull}>
          Ler agora da API Holyrics
        </button>
      </section>

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
    </main>
  );
}

export default App;
