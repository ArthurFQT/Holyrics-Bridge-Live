# Task 11 - Persistencia mais robusta

## Objetivo

Tornar a persistencia de configuracoes mais segura contra arquivo corrompido, escrita incompleta ou mudancas futuras de formato.

## Contexto

O backend salva configuracoes em `server/data/runtime-config.json`. Isso e simples e adequado para o projeto, mas pode ser melhor protegido.

## Escopo sugerido

- Validar estrutura do JSON carregado.
- Criar backup antes de sobrescrever configuracao.
- Escrever em arquivo temporario e depois substituir o arquivo final.
- Manter campo de versao e preparar migracoes futuras.
- Ignorar campos desconhecidos com seguranca.
- Adicionar endpoint ou botao para restaurar padrao.
- Adicionar mensagem clara quando configuracao nao puder ser carregada.

## Fora de escopo

- Migrar para banco de dados.
- Criar sincronizacao entre maquinas.

## Criterios de aceite

- Config corrompida nao impede servidor de iniciar.
- Existe backup recente recuperavel.
- Escrita interrompida tem menor chance de destruir a config atual.
- Versao da config e respeitada.
- Usuario entende quando a config foi restaurada para padrao.
