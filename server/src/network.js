import os from "node:os";

import axios from "axios";

// Lista os enderecos IPv4 nao-internos desta maquina - usado por
// `resolveServerUrls` (log de boot) e `discoverHolyricsHosts` (varredura de
// rede) abaixo, no mesmo arquivo; nao precisa ser exportado.
const listLocalIPv4Addresses = () => {
  const addresses = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push({ address: entry.address, netmask: entry.netmask });
      }
    }
  }

  return addresses;
};

export const resolveServerUrls = (listenHost, listenPort) => {
  const normalizedHost = String(listenHost || "")
    .trim()
    .toLowerCase();
  const onAllInterfaces = normalizedHost === "0.0.0.0" || normalizedHost === "::";
  const urls = new Set();

  if (onAllInterfaces) {
    urls.add(`http://localhost:${listenPort}`);
    for (const { address } of listLocalIPv4Addresses()) {
      urls.add(`http://${address}:${listenPort}`);
    }
  } else {
    urls.add(`http://${listenHost}:${listenPort}`);
  }

  return [...urls];
};

const ipv4ToInt = (ip) =>
  ip.split(".").reduce((acc, octet) => (acc << 8) + (Number(octet) & 255), 0) >>> 0;

const intToIpv4 = (value) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");

// Devolve todos os IPs "de host" (exclui rede e broadcast) da sub-rede de
// `address`/`netmask`, limitado a `maxHosts` para nunca varrer uma faixa
// gigante por engano (ex: uma mascara mal configurada).
const listHostsInSubnet = (address, netmask, maxHosts) => {
  const addressInt = ipv4ToInt(address);
  const netmaskInt = ipv4ToInt(netmask);
  const networkInt = (addressInt & netmaskInt) >>> 0;
  const broadcastInt = (networkInt | (~netmaskInt >>> 0)) >>> 0;
  const totalHosts = Math.max(broadcastInt - networkInt - 1, 0);

  if (totalHosts <= 0 || totalHosts > maxHosts) {
    return [];
  }

  const hosts = [];
  for (let value = networkInt + 1; value < broadcastInt; value += 1) {
    hosts.push(intToIpv4(value));
  }

  return hosts;
};

const buildScanHeaders = (token, tokenHeader) => {
  if (!token) {
    return {};
  }

  if (String(tokenHeader || "Authorization").toLowerCase() === "authorization") {
    return { Authorization: `Bearer ${token}` };
  }

  return { [tokenHeader || "Authorization"]: token };
};

const probeHost = async ({ host, port, path, method, token, tokenHeader, timeoutMs }) => {
  const url = `http://${host}:${port}${path}`;

  try {
    const response = await axios({
      method: method || "GET",
      url,
      timeout: timeoutMs,
      headers: buildScanHeaders(token, tokenHeader),
      validateStatus: (status) => status === 200,
    });

    // Um host so conta como candidato se devolver algo parecido com a
    // resposta do Holyrics (objeto JSON) - evita listar qualquer servidor
    // HTTP aleatorio que responda 200 na porta testada.
    if (response.data && typeof response.data === "object") {
      return { host, ok: true };
    }

    return { host, ok: false };
  } catch (_error) {
    return { host, ok: false };
  }
};

const runInBatches = async (items, limit, worker) => {
  const results = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }
  return results;
};

const DISCOVERY_MAX_HOSTS_PER_SUBNET = 512;
const DISCOVERY_CONCURRENCY = 40;
const DISCOVERY_TIMEOUT_MS = 400;

// Varre a(s) sub-rede(s) desta maquina procurando por algo respondendo como
// o Holyrics no host/porta/path configurados, para que o operador nao
// precise descobrir manualmente o IP da maquina do Holyrics (ex: rodando
// `ipconfig` nela). Usa o mesmo path/metodo/token configurados no painel,
// entao um "hit" aqui e a mesma chamada que o pull real faria.
export const discoverHolyricsHosts = async ({
  port,
  path,
  method = "GET",
  token = "",
  tokenHeader = "Authorization",
}) => {
  const startedAt = Date.now();
  const subnets = listLocalIPv4Addresses();

  const candidateHosts = new Set();
  for (const { address, netmask } of subnets) {
    for (const host of listHostsInSubnet(address, netmask, DISCOVERY_MAX_HOSTS_PER_SUBNET)) {
      candidateHosts.add(host);
    }
  }

  const results = await runInBatches([...candidateHosts], DISCOVERY_CONCURRENCY, (host) =>
    probeHost({
      host,
      port,
      path,
      method,
      token,
      tokenHeader,
      timeoutMs: DISCOVERY_TIMEOUT_MS,
    })
  );

  return {
    scannedHosts: candidateHosts.size,
    tookMs: Date.now() - startedAt,
    candidates: results.filter((result) => result.ok).map(({ host }) => host),
  };
};
