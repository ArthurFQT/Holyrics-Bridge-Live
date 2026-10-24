# Iniciar o Holyrics Bridge Live junto com o vMix

O Windows nao tem um jeito nativo de "quando abrir o programa X, abra o
programa Y junto" — isso precisa de um pequeno script fazendo a ponte. Este
guia mostra duas formas de resolver, dos scripts prontos em
`scripts/windows/`:

- **Opcao A (recomendada): iniciar o Bridge no login do Windows.** Mais
  simples e mais confiavel — o Bridge fica pronto _antes_ mesmo de voce
  abrir o vMix, sem depender de qual atalho voce clica.
- **Opcao B: um atalho que abre o Bridge e o vMix juntos.** Mais fiel ao
  pedido literal ("quando abrir o vMix"), mas depende de voce sempre abrir
  o vMix por esse atalho especifico.

Em ambos os casos, o script sobe o projeto com `npm run dev` (o mesmo
comando que voce já usa manualmente) — nada de configuracao nova, so
automatiza o "abrir o terminal e digitar o comando".

## Instalando o projeto numa maquina nova (ex: o PC do vMix)

Se a maquina onde o vMix roda ainda nao tem o projeto (o mais comum, ja que
normalmente e uma maquina diferente da que voce usa para desenvolver),
siga estes passos nela primeiro:

1. **Levar o projeto para a maquina**. Forma mais simples, sem precisar
   configurar Git/SSH nessa maquina: acesse
   `https://github.com/ArthurFQT/Holyrics-Bridge-Live` no navegador dela ->
   botao verde "Code" -> "Download ZIP" -> extraia em algum lugar, ex.
   `C:\Holyrics-Bridge-Live`. Se preferir usar Git, `git clone
https://github.com/ArthurFQT/Holyrics-Bridge-Live.git` funciona igual.
2. **Instalar o Node.js**, se ainda nao tiver - baixe a versao LTS em
   [nodejs.org](https://nodejs.org) e instale normalmente.
3. **Instalar as dependencias**: abra o Prompt de Comando dentro da pasta
   do projeto e rode:
   ```
   npm install
   ```
4. **Configurar o `.env` do backend**: copie `server\.env.example` para
   `server\.env` (os valores padrao servem na maioria dos casos). O IP/porta
   do Holyrics se configuram depois, pelo painel (secao "Integracao
   Holyrics", com um botao para procurar o Holyrics na rede
   automaticamente), nao pelo `.env`. O `.env` do painel (`control-panel`)
   tambem nao precisa de nenhum ajuste - ele detecta o backend sozinho (ver
   [Guia de cenarios reais](guia-cenarios-reais.md)).
5. **Testar manualmente**: de duplo-clique em `scripts\windows\iniciar-bridge.bat`
   (dentro da copia do projeto **nessa maquina**) e confirme que abre uma
   janela com os logs do `npm run dev` e que
   `http://localhost:3001/health` responde no navegador.

So depois de confirmar que isso funciona manualmente e que parta para a
automatizacao (Opcao A ou B abaixo) - usando sempre os caminhos da copia do
projeto **dessa maquina**, nao da maquina de desenvolvimento.

## Opcao A - Iniciar no login do Windows

1. Pressione `Win + R`, digite `shell:startup` e Enter. Isso abre a pasta
   "Inicializar" do seu usuario.
2. Copie um atalho para dentro dessa pasta apontando para:
   - `scripts\windows\iniciar-bridge.bat` (abre uma janela com os logs -
     recomendado para o dia a dia, voce consegue ver se o Holyrics esta
     respondendo), ou
   - `scripts\windows\iniciar-bridge-oculto.vbs` (roda sem nenhuma janela
     visivel, mais "limpo" mas mais dificil de perceber se der problema).

   Para criar o atalho: clique com o botao direito no arquivo dentro de
   `scripts\windows\` -> "Criar atalho" -> arraste esse atalho para a pasta
   `Inicializar` aberta no passo 1.

3. Pronto. Da proxima vez que voce ligar o PC e fizer login, o Bridge sobe
   sozinho. Abra o vMix normalmente, do jeito que sempre abriu.

### Alternativa mais robusta: Agendador de Tarefas

Se quiser algo mais controlavel (ex: rodar so quando conectado a uma rede
especifica, ver o historico de execucoes, etc), use o Agendador de Tarefas
do Windows em vez da pasta Inicializar:

1. Abra o "Agendador de Tarefas" (Task Scheduler).
2. "Criar Tarefa..." (nao "Tarefa Basica", para ter mais opcoes).
3. Aba **Geral**: de um nome, ex. "Holyrics Bridge Live"; marque "Executar
   estando o usuario conectado ou nao" se quiser que rode mesmo sem login
   automatico visivel (nesse caso use o `.vbs`, nao o `.bat`).
4. Aba **Disparadores**: Novo -> "Ao fazer logon" -> OK.
5. Aba **Acoes**: Novo -> Programa/script: `wscript.exe` -> Argumentos:
   caminho completo para `iniciar-bridge-oculto.vbs` (entre aspas se tiver
   espaco no caminho).
6. Salve.

## Opcao B - Atalho que abre o Bridge e o vMix juntos

1. Abra `scripts\windows\abrir-vmix-com-bridge.bat` num editor de texto e
   confira a linha `VMIX_PATH` — ajuste para o caminho real do
   `vMix64.exe` na sua maquina (o padrao mais comum e
   `C:\Program Files (x86)\vMix\vMix64.exe`). Para descobrir o caminho
   certo, clique com o botao direito no atalho do vMix que voce ja usa ->
   Propriedades -> campo "Destino".
2. Teste dando duplo-clique nesse `.bat`: deve abrir uma janela com os
   logs do Bridge e, em seguida, o vMix.
3. Depois de confirmar que funciona, substitua o atalho que voce usa hoje
   para abrir o vMix (area de trabalho, barra de tarefas, menu iniciar) por
   um atalho para este `.bat` no lugar:
   - Botao direito no `abrir-vmix-com-bridge.bat` -> "Criar atalho".
   - Mova esse novo atalho para onde estava o atalho antigo do vMix (area
     de trabalho, etc), renomeie para "vMix" se quiser.
   - Opcional: botao direito no atalho -> Propriedades -> "Alterar Icone"
     -> aponte para o `vMix64.exe` para o atalho ficar com o icone do vMix.

## Verificando que esta funcionando

- `http://localhost:3001/health` deve responder `{"ok":true}`.
- O painel deve abrir em `http://localhost:5173` (ou pelo IP da rede,
  ver o [Guia de cenarios reais](guia-cenarios-reais.md)) mostrando
  "Conectado".

## Troubleshooting

- **A janela do `.bat` fecha na hora / erro "npm nao e reconhecido"**:
  Node.js nao esta instalado ou nao esta no PATH do sistema. Abra um
  Prompt de Comando comum e rode `node -v` e `npm -v` para confirmar que
  funcionam ali primeiro.
- **Script roda mas a porta 3001 nunca responde**: abra a janela do
  `iniciar-bridge.bat` (nao use a variante oculta enquanto debuga) e veja
  o erro nos logs do `npm run dev`.
- **Rodando via Agendador de Tarefas e nao funciona, mas manualmente
  funciona**: confirme que a tarefa esta configurada para rodar como o seu
  usuario (nao SYSTEM) e com "Executar apenas quando o usuario estiver
  conectado", caso contrario o Node pode nao enxergar as mesmas variaveis
  de ambiente/permissões da sua sessao grafica.
- **vMix nao abre pelo `abrir-vmix-com-bridge.bat`**: o caminho em
  `VMIX_PATH` esta errado - confira nas Propriedades do atalho original do
  vMix.

## Fora de escopo deste guia

- Rodar o Bridge como um Servico do Windows "de verdade" (via `nssm` ou
  similar) - possivel, mas mais complexo de configurar/depurar do que o
  necessario aqui.
- Build de producao (`npm run build` + servir os arquivos estaticos) em
  vez de `npm run dev` - o modo dev e o mesmo que voce ja usa hoje e e
  suficiente para uso continuo; so vale a pena migrar se notar problemas
  de performance/estabilidade especificos do modo dev.
