# Task 08 - Presets nomeados e exportaveis

## Objetivo

Permitir criar, salvar, renomear, aplicar, exportar e importar presets de estilo para musicas, biblia e outros usos recorrentes.

## Contexto

O painel ja possui presets fixos para Biblia e Musica. O proximo passo natural e transformar isso em um recurso configuravel pelo usuario.

## Escopo sugerido

- Criar lista de presets salvos.
- Permitir salvar o estilo atual como novo preset.
- Permitir renomear preset.
- Permitir excluir preset com confirmacao.
- Aplicar preset ao canal atual.
- Exportar presets como JSON.
- Importar presets a partir de JSON.
- Persistir presets no arquivo de configuracao runtime.

## Fora de escopo

- Sincronizar presets em nuvem.
- Marketplace de presets.
- Edicao visual avancada fora do painel atual.

## Criterios de aceite

- Usuario consegue salvar o estilo atual como preset nomeado.
- Presets continuam disponiveis apos reiniciar o servidor.
- Exportar e importar preserva os campos de estilo.
- Importacao invalida mostra erro compreensivel.
- Aplicar preset nao altera texto do canal, apenas estilo.
