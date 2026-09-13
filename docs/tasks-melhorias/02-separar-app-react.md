# Task 02 - Separar melhor o App.jsx

## Objetivo

Reduzir o tamanho e a complexidade de `control-panel/src/App.jsx`, separando a interface em componentes menores e mais faceis de manter.

## Contexto

O painel concentra componentes reutilizaveis, estado global, formularios, preview, integracao Holyrics e dialogos no mesmo arquivo. Isso funciona, mas torna futuras alteracoes mais arriscadas.

## Escopo sugerido

- Criar componentes para editor de canal, controles de estilo, configuracao Holyrics, configuracao de layout, preview e dialogo de confirmacao.
- Extrair constantes como canais, fontes, posicoes e estilos iniciais para arquivos proprios.
- Extrair helpers de estilo, parsing e fetch para utilitarios.
- Manter o comportamento atual durante a refatoracao.

## Fora de escopo

- Redesenhar visualmente o painel.
- Mudar endpoints do backend.
- Alterar regras de negocio.

## Criterios de aceite

- `App.jsx` fica focado em orquestracao de estado e composicao da tela.
- Componentes possuem nomes claros e responsabilidades pequenas.
- O painel continua carregando os estados dos canais corretamente.
- Enviar texto, salvar estilo, salvar Holyrics e salvar layout continuam funcionando.
- Build do painel continua passando.
