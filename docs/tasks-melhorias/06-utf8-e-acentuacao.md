# Task 06 - Corrigir e garantir UTF-8

## Objetivo

Padronizar arquivos e textos do projeto em UTF-8 para evitar caracteres quebrados no painel, README e documentacao.

## Contexto

Alguns textos apareceram com acentuacao quebrada no terminal, por exemplo `aparencia` renderizado como caracteres estranhos em alguns pontos. Pode ser configuracao do terminal, mas vale blindar o projeto.

## Escopo sugerido

- Verificar encoding dos arquivos `.md`, `.jsx`, `.css`, `.html` e `.js`.
- Corrigir textos quebrados no painel e na documentacao.
- Adicionar `.editorconfig` com `charset = utf-8`.
- Garantir que o HTML tenha `<meta charset="UTF-8">` onde necessario.
- Documentar recomendacao de salvar arquivos como UTF-8.

## Fora de escopo

- Traduzir textos.
- Reescrever toda a documentacao.

## Criterios de aceite

- Acentos aparecem corretamente no painel.
- Acentos aparecem corretamente no display.
- README e docs abrem corretamente em editores comuns.
- Novos arquivos seguem UTF-8 por padrao.
