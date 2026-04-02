# Holyrics -> vMix (tempo real)

Sistema local de exibicao de letras em tempo real para uso com Browser Input do vMix.

Fluxo:

`Holyrics -> Backend Node.js -> WebSocket -> Display (vMix)`

## Objetivo do projeto

Entregar letras de **musica** e textos de **biblia** do Holyrics para o vMix com baixa latencia, permitindo:

- sincronizacao em tempo real (sem reload da pagina de display)
- separacao por canais (`music` e `bible`)
- personalizacao visual completa no painel (fonte, sombra, fundo, gradiente)
- uso direto em Browser Input do vMix

## Como usar (rapido)

1. Rode o projeto:

```bash
npm install
npm run dev
```

2. Abra o painel:
- `http://localhost:5173`

3. Abra no vMix os Browser Inputs:
- musica: `http://localhost:3001/display/music`
- biblia: `http://localhost:3001/display/bible`

4. No painel, ajuste:
- integracao Holyrics (`/view/text.json`, `map.text`, etc.)
- estilo visual
- destino (`music`, `bible`, `default`, `all`)

5. Use o Holyrics normalmente:
- o backend detecta `type` e envia para o canal correto em tempo real.

## Estrutura

- `server`: Express + Socket.IO (websocket-only)
- `control-panel`: Painel React para texto e estilo
- `server/public/display`: Pagina leve de exibicao com fundo transparente

## Canais (separacao Musica/Biblia)

O backend mantem 3 canais independentes:

- `default`: monitor geral (espelho do ultimo canal atualizado)
- `music`: letras de musica
- `bible`: textos biblicos

No Holyrics pull, o roteamento e automatico pelo `type` retornado (ex: `MUSIC` -> `music`, `BIBLE` -> `bible`).

## Personalizacao visual (Biblia e Musica)

No painel de controle, cada envio permite configurar:

- cor do texto
- tamanho e familia de fonte
- alinhamento
- sombra (on/off + intensidade)
- background por modo (`backgroundMode`):
- `transparent`
- `solid`
- `gradient`

No modo `gradient` voce pode definir:

- cor base
- direcao (incluindo `canto inferior esquerdo para topo direito`)
- opacidade inicial
- alcance ate transparencia

Existe tambem o botao `Preset Biblia (gradiente canto inferior esquerdo)`.

## Quebra de linhas (musica)

Voce pode configurar no painel a quebra automatica das letras de musica por bloco de linhas:

- desativado
- 2 linhas
- 3 linhas
- 4 linhas
- 5 linhas

Exemplo: musica com 5 linhas e quebra em 3 -> backend entrega `3 + 2` linhas com uma linha em branco entre os blocos.

## Requisitos

- Node.js 18+
- npm 9+

## Como executar

1. Instale dependencias na raiz:

```bash
npm install
```

2. (Opcional) Configure variaveis do backend:

```bash
copy server\.env.example server\.env
```

3. Suba backend + painel juntos:

```bash
npm run dev
```

4. URLs:

- Painel React: `http://localhost:5173`
- Display default: `http://localhost:3001/display`
- Display musica: `http://localhost:3001/display/music`
- Display biblia: `http://localhost:3001/display/bible`
- Health backend: `http://localhost:3001/health`

## API do backend

### Atualizar letra/estilo manualmente

`POST /letra`

```json
{
  "texto": "Linha 1\nLinha 2",
  "target": "music",
  "estilo": {
    "color": "#ffffff",
    "fontSize": 72,
    "fontFamily": "Montserrat, sans-serif",
    "textAlign": "center",
    "shadowEnabled": true,
    "shadowIntensity": 60,
    "backgroundMode": "gradient",
    "backgroundColor": "#000000",
    "gradientColor": "#1b1b1b",
    "gradientOpacity": 75,
    "gradientSpread": 88,
    "gradientDirection": "to top right",
    "fade": true
  }
}
```

`target` aceito: `default`, `music`, `bible`, `all`.

### Estado atual

- `GET /estado?channel=default|music|bible`
- `GET /estado/all`

### Configuracao de layout (musica)

- `GET /layout/config`
- `POST /layout/config`

Payload:

```json
{
  "music": {
    "breakEveryLines": 3
  }
}
```

### Webhook (push) vindo do Holyrics

`POST /holyrics/webhook`

Aceita `texto`, `text`, `lyric`, `current.texto`, `current.text` e usa `type` para separar musica/biblia quando presente.

### Configuracao da integracao Holyrics

- `GET /holyrics/config`
- `POST /holyrics/config`
- `POST /holyrics/pull-now` (forcar leitura imediata)
- `GET /holyrics/diagnostics`

## Exemplo de integracao com Holyrics via API

Configuracao recomendada para Holyrics WebService Plugin:

```json
{
  "host": "127.0.0.1",
  "port": 8080,
  "path": "/view/text.json",
  "method": "GET",
  "token": "",
  "tokenHeader": "Authorization",
  "textPath": "map.text",
  "pullEnabled": true,
  "pullIntervalMs": 400,
  "timeoutMs": 1500
}
```

Se sua API devolver texto em outro caminho, ajuste `textPath`.

## Uso no vMix

1. Abra o `Browser Input` para cada camada desejada.
2. Use uma URL por camada:
- musica: `http://localhost:3001/display/music`
- biblia: `http://localhost:3001/display/bible`
3. Ative transparencia no Browser Input (alpha channel).
4. Controle texto/estilo pelo painel em `http://localhost:5173`.

## Observacoes de latencia

- Socket.IO em `transports: ["websocket"]` (sem fallback polling).
- Display aplica atualizacoes sem reload.
- Estado em memoria para minimizar overhead.
