# Task 05 - Melhorar diagnostico no painel

## Objetivo

Exibir no painel informacoes claras sobre a conexao com o Holyrics e o estado da ultima leitura, para facilitar suporte durante eventos ao vivo.

## Contexto

O backend ja possui `/holyrics/diagnostics`, mas o painel ainda nao explora essas informacoes como uma area visual de diagnostico.

## Escopo sugerido

- Mostrar ultima tentativa de leitura.
- Mostrar ultimo sucesso.
- Mostrar ultimo erro.
- Mostrar URL consultada.
- Mostrar tipo detectado pelo Holyrics.
- Mostrar canal resolvido.
- Mostrar tamanho do texto recebido.
- Mostrar preview curto da resposta bruta, com cuidado para nao poluir a interface.
- Adicionar botao de atualizar diagnostico.

## Fora de escopo

- Criar sistema completo de logs historicos.
- Enviar logs para servico externo.

## Criterios de aceite

- Operador consegue entender rapidamente se o Holyrics esta respondendo.
- Erros de conexao, timeout ou campo de texto errado ficam visiveis no painel.
- O botao "Ler agora da API Holyrics" atualiza tambem o diagnostico.
- A area de diagnostico nao atrapalha o uso principal do painel.
