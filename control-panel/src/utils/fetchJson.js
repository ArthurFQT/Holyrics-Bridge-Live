// Wrapper around fetch() that surfaces non-2xx responses as real errors
// instead of silently parsing whatever body came back (or throwing an
// opaque "Unexpected token" error when the body isn't JSON at all).
export const fetchJson = async (url, options) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch (_error) {
      // ignore - body may not be readable
    }
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Resposta do servidor nao e um JSON valido.");
  }
};
