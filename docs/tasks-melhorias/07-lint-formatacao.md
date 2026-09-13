# Task 07 - Adicionar lint e formatacao

## Objetivo

Adicionar ferramentas simples de padronizacao para reduzir regressao e manter o codigo consistente.

## Contexto

O projeto ainda nao possui scripts de lint ou formatacao. Como ha logica de estado, parsing e React no mesmo repositorio, uma validacao automatica ajudaria bastante.

## Escopo sugerido

- Adicionar ESLint para backend e frontend.
- Adicionar Prettier para formatacao.
- Criar scripts na raiz, por exemplo `lint`, `format` e `check`.
- Configurar regras compativeis com React, ESM e Node.
- Evitar regras agressivas no primeiro momento.

## Fora de escopo

- Migrar para TypeScript.
- Refatorar codigo apenas por estilo.
- Criar pipeline CI completo, a menos que vire uma task separada.

## Criterios de aceite

- `npm run lint` valida frontend e backend.
- `npm run format` formata arquivos suportados.
- `npm run check` pode rodar lint e build.
- O projeto continua buildando depois da formatacao.
