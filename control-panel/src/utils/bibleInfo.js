export const parseBibleInfo = (info = {}) => ({
  version: typeof info?.version === "string" ? info.version.trim() : "",
  reference: typeof info?.reference === "string" ? info.reference.trim() : "",
});

export const parseType = (value) => (typeof value === "string" ? value.trim() : "");
