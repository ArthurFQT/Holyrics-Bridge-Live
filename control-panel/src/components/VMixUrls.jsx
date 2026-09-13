import { useState } from "react";

const VMIX_ROUTES = [
  { path: "/display", label: "Browser Input Default" },
  { path: "/display/music", label: "Browser Input Musica" },
  { path: "/display/bible", label: "Browser Input Biblia" },
];

// Fallback para quando `navigator.clipboard` nao existe ou rejeita - o caso
// mais comum aqui e o painel sendo acessado por IP na rede local via HTTP
// (ex: `http://192.168.0.12:5173`), um contexto que a maioria dos
// navegadores considera "inseguro" e por isso desativa a Clipboard API
// moderna. `execCommand("copy")` e deprecated mas ainda funciona nesse
// cenario, entao serve como fallback pratico.
const copyWithFallback = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_error) {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
};

const VMixUrls = ({ backendUrl }) => {
  const [copyState, setCopyState] = useState({ path: "", status: "" });

  const handleCopy = async (path, url) => {
    let copied = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch (_error) {
        copied = false;
      }
    }

    if (!copied) {
      copied = copyWithFallback(url);
    }

    setCopyState({ path, status: copied ? "ok" : "error" });
    setTimeout(
      () => setCopyState((current) => (current.path === path ? { path: "", status: "" } : current)),
      1500
    );
  };

  return (
    <div className="vmix-urls">
      {VMIX_ROUTES.map(({ path, label }) => {
        const url = `${backendUrl}${path}`;

        return (
          <p className="tips vmix-url-row" key={path}>
            <span>
              {label}: <code>{url}</code>
            </span>
            <button
              type="button"
              className="ghost copy-button"
              onClick={() => handleCopy(path, url)}
            >
              {copyState.path === path
                ? copyState.status === "ok"
                  ? "Copiado!"
                  : "Falha ao copiar"
                : "Copiar"}
            </button>
          </p>
        );
      })}
    </div>
  );
};

export default VMixUrls;
