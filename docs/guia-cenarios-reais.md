# Guia de cenarios reais

Este guia complementa o `README.md` com passos praticos para colocar o
Holyrics Bridge Live para funcionar em situacoes reais de evento, alem de
troubleshooting para os problemas mais comuns.

## Portas usadas

| Servico                     | Porta padrao                    | Onde roda                       |
| --------------------------- | ------------------------------- | ------------------------------- |
| Painel de controle (dev)    | `5173`                          | Maquina do operador             |
| Backend + display (Express) | `3001`                          | Maquina que fica ligada ao vMix |
| Holyrics WebService Plugin  | `4747` ou `8080` (configuravel) | Maquina do Holyrics             |

`PORT` e `HOST` do backend ficam em `server/.env` (copie de
`server/.env.example`).

O painel **detecta o backend automaticamente**: ele usa o mesmo host pelo
qual voce abriu a pagina do painel (ex: abriu em `http://192.168.0.6:5173`
-> backend em `http://192.168.0.6:3001`). Isso significa que, na maioria
dos casos, voce nao precisa configurar nada no `control-panel/.env` mesmo
que o IP da rede mude. So defina `VITE_BACKEND_URL` (em
`control-panel/.env`, copiado de `control-panel/.env.example`) se o backend
rodar numa **maquina diferente** da que serve o painel (ver Cenario 2).

## Como descobrir o IP da maquina na rede local

- **Windows**: abra o Prompt de Comando e rode `ipconfig`. Procure
  "Endereco IPv4" da interface conectada (Wi-Fi ou Ethernet), algo como
  `192.168.0.12`.
- **macOS**: `ipconfig getifaddr en0` (Wi-Fi) ou `en1`/`en0` conforme a
  interface.
- **Linux**: `ip addr show` ou `hostname -I`.

Use esse IP (nao `localhost`) sempre que o Holyrics, o vMix, o painel ou o
display estiverem em **maquinas diferentes**. Quando tudo roda na mesma
maquina, `localhost` ou `127.0.0.1` funciona normalmente.

## Cenario 1 - Tudo em uma unica maquina

Holyrics, backend, painel e vMix na mesma maquina.

1. Configure `server/.env` com `HOLYRICS_HOST=127.0.0.1` e a porta do
   WebService Plugin do Holyrics.
2. `npm run dev` na raiz (nao precisa mexer em `control-panel/.env`).
3. No vMix, use os Browser Input com `http://localhost:3001/display/...`.
4. Abra o painel em `http://localhost:5173`.

## Cenario 2 - Holyrics em um PC, vMix em outro

Holyrics roda no PC de projecao/louvor, vMix (e o backend) rodam no PC de
transmissao.

1. Descubra o IP do PC onde o **backend** vai rodar (ex: `192.168.0.10`).
2. No PC do Holyrics, ative o WebService Plugin e anote a porta usada
   (padrao comum: `4747` ou `8080`).
3. No PC do backend/vMix, configure `server/.env`:
   - `HOLYRICS_HOST=<IP do PC do Holyrics>`
   - `HOLYRICS_PORT=<porta do WebService Plugin>`
4. Rode o backend nesse PC (`npm run dev:server` ou `npm start` apos
   `npm run build`).
5. No vMix (mesmo PC), use `http://localhost:3001/display/...` nos Browser
   Input (mesma maquina que o backend).
6. Acesse o painel de outro dispositivo na rede (ver Cenario 3) ou
   localmente com `http://localhost:5173`.

## Cenario 3 - Painel acessado por outro dispositivo na rede

Util para o operador controlar letras/estilo do celular, tablet ou notebook
sem precisar sentar no PC do vMix.

1. Descubra o IP do PC que roda o painel e o backend (ex: `192.168.0.10`) -
   veja "Como descobrir o IP" acima.
2. Suba o projeto normalmente com `npm run dev` na raiz (ja usa `--host`,
   entao aceita conexoes de outros dispositivos). Nao precisa configurar
   `control-panel/.env`.
3. No celular/tablet (mesma rede Wi-Fi), acesse
   `http://192.168.0.10:5173` - o painel detecta sozinho que o backend fica
   em `http://192.168.0.10:3001`.

### Quando `VITE_BACKEND_URL` e realmente necessario

Só se o processo do painel (`control-panel`, Vite) e o processo do backend
(`server`, Express) rodarem em **maquinas fisicas diferentes** (não é o caso
de nenhum dos cenarios acima, onde `npm run dev` sobe os dois juntos).
Nesse caso, configure `control-panel/.env` com
`VITE_BACKEND_URL=http://<ip-da-maquina-do-backend>:3001`.

## Troubleshooting

### Firewall bloqueando a porta

Sintoma: painel mostra "Desconectado" e requisicoes para `/estado` ou
`/holyrics/config` falham quando acessadas de outro dispositivo, mas
funcionam em `localhost`.

- Libere as portas `3001` (backend) e `5173` (painel, se acessado de outro
  dispositivo) no firewall do Windows (Firewall do Windows Defender >
  Configuracoes avancadas > Regra de Entrada > Nova Regra > Porta).

### Porta ja em uso (`EADDRINUSE`)

Sintoma: o backend imprime
`[server] <host>:<porta> ja esta em uso. Encerre o processo antigo ou altere HOST/PORT no .env.`
e nao inicia.

- Feche a instancia antiga do backend (verifique processos `node` abertos)
  ou mude a `PORT` em `server/.env`.

### Holyrics sem o plugin WebService ativo

Sintoma: diagnostico do painel (secao "Diagnostico Holyrics") mostra
`ULTIMO ERRO` com `ECONNREFUSED` ou timeout constante.

- Confirme que o WebService Plugin do Holyrics esta instalado e ativo.
- Confirme host e porta configurados no painel (secao "Integracao
  Holyrics") batem com os do plugin.
- Use o botao "Ler agora da API Holyrics" e observe o diagnostico
  atualizar com o erro especifico.

### Path/porta errados (resposta vazia ou campo errado)

Sintoma: diagnostico mostra sucesso (`ULTIMO SUCESSO` preenchido) mas
`TAMANHO DO TEXTO` fica sempre `0`, ou o texto que chega no display esta
errado.

- Confira `Path da API` (ex: `/view/text.json`) e `Campo do texto (path)`
  (ex: `map.text`) na secao "Integracao Holyrics" do painel.
- Use o preview da resposta bruta no "Diagnostico Holyrics" para ver o JSON
  real devolvido pelo Holyrics e ajustar o path do campo de texto.

### CORS bloqueando o painel

Sintoma: erros de CORS no console do navegador ao carregar o painel a
partir de outro dispositivo/dominio.

- Ajuste `PANEL_ORIGIN` em `server/.env` para incluir a origem do painel
  (ex: `http://192.168.0.12:5173`), ou deixe `*` para aceitar qualquer
  origem (padrao, adequado para rede local confiavel).

## Comportamento em quedas de conexao (display)

O display (`/display`, `/display/music`, `/display/bible`) usa Socket.IO
com reconexao automatica:

- Numa queda curta, o ultimo texto/estilo permanece na tela sem piscar.
- Se a reconexao demorar mais de 15 segundos, o display oculta o texto por
  seguranca (para nao travar uma tela desatualizada indefinidamente) e volta
  a mostrar o estado correto assim que a conexao voltar - o servidor sempre
  reenvia o estado atual do canal a cada nova conexao.
- Nenhuma mensagem de erro aparece na tela (fica so no console do
  navegador), para nao vazar para a saida do vMix.

## Checklist pre-evento

- [ ] Backend rodando e `http://<ip-do-backend>:3001/health` responde `{"ok":true}`.
- [ ] Diagnostico Holyrics no painel mostra `ULTIMO SUCESSO` recente.
- [ ] Browser Input do vMix aponta para as URLs corretas
      (`/display`, `/display/music`, `/display/bible`) com transparencia
      (alpha channel) ativada.
- [ ] Estilo de cada canal (musica, biblia) revisado no painel.
- [ ] Presets do evento (se usados) conferidos na secao "Presets de estilo".
- [ ] Painel acessivel do dispositivo do operador (celular/tablet/notebook).
- [ ] Firewall liberado nas maquinas envolvidas, se painel/backend/Holyrics
      estiverem em maquinas diferentes.
- [ ] Testar um texto de musica e um texto de biblia ao vivo antes do
      inicio, incluindo o botao "Ocultar canal" e "Limpar canal atual".
