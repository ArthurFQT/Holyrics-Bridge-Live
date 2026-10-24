import { promises as fs } from "node:fs";
import path from "node:path";

export const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Cria um pequeno "store" generico de persistencia em disco: nao sabe nada
// sobre o formato dos dados do app (canais, estilos, Holyrics, etc) - so
// sabe ler/escrever um JSON com um campo `version`, com backup automatico e
// escrita atomica. Quem monta o payload (`buildPersistedRuntimeConfig` em
// index.js) e quem conhece o formato; este modulo so cuida da mecanica de
// arquivo, para poder ser testado/entendido isoladamente.
export const createRuntimeConfigStore = ({ filePath, backupPath, version }) => {
  const tmpPath = `${filePath}.tmp`;

  const isValidShape = (parsed) => isPlainObject(parsed) && Number.isFinite(Number(parsed.version));

  const readFile = async (target) => {
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw);

    if (!isValidShape(parsed)) {
      throw new Error("formato invalido (campo 'version' ausente ou invalido)");
    }

    return parsed;
  };

  // Tenta o arquivo principal, depois o backup, depois desiste e volta aos
  // valores padrao do chamador (`null`). `status.source` informa de onde a
  // config ativa veio, para o painel poder avisar o operador quando algo
  // precisou ser recuperado.
  const load = async () => {
    try {
      const config = await readFile(filePath);
      return { config, status: { source: "file", warning: null } };
    } catch (mainError) {
      const mainMissing = mainError?.code === "ENOENT";

      try {
        const backupConfig = await readFile(backupPath);
        return {
          config: backupConfig,
          status: {
            source: "backup",
            warning: mainMissing
              ? null
              : `Configuracao principal estava corrompida (${mainError.message}). Valores recuperados do backup mais recente.`,
          },
        };
      } catch (backupError) {
        const backupMissing = backupError?.code === "ENOENT";
        const bothMissing = mainMissing && backupMissing;

        return {
          config: null,
          status: {
            source: "defaults",
            warning: bothMissing
              ? null
              : "Configuracao salva e backup estavam corrompidos ou inacessiveis - iniciando com valores padrao.",
          },
        };
      }
    }
  };

  // Guarda uma copia do arquivo anterior antes de sobrescrever (para um
  // estado recuperavel) e escreve em um arquivo temporario antes de
  // substituir o final - `rename` e atomico no mesmo filesystem, entao uma
  // interrupcao a meio da escrita nunca deixa o arquivo principal
  // truncado/corrompido.
  const saveNow = async (payload) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      await fs.copyFile(filePath, backupPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`[runtime-config] Falha ao criar backup: ${error.message}`);
      }
    }

    await fs.writeFile(tmpPath, JSON.stringify({ version, ...payload }, null, 2), "utf8");
    await fs.rename(tmpPath, filePath);
  };

  let scheduledTimer;

  // Recebe uma funcao que monta o payload ATUAL (nao um payload fixo),
  // porque o debounce pode disparar bem depois de agendado - lendo o estado
  // no momento do disparo garante que a ultima mudanca sempre seja
  // persistida, mesmo que varias mudancas cheguem dentro da janela.
  const schedulePersist = (buildPayload, delayMs = 180) => {
    if (scheduledTimer) {
      clearTimeout(scheduledTimer);
    }

    scheduledTimer = setTimeout(() => {
      saveNow(buildPayload()).catch((error) => {
        console.warn(`[runtime-config] Falha ao salvar configuracao: ${error.message}`);
      });
    }, delayMs);
  };

  return { load, saveNow, schedulePersist };
};
