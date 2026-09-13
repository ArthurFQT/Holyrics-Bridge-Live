# Task 10 - Melhorar fallback e reconexao do display

## Objetivo

Deixar o display mais resistente quando o backend reinicia, a rede oscila ou o WebSocket desconecta.

## Contexto

O display usa Socket.IO com transporte websocket, bom para baixa latencia. Em uso ao vivo, e importante que reconexao e estado visual sejam previsiveis.

## Escopo sugerido

- Tratar eventos de `connect`, `disconnect`, `connect_error` e `reconnect`.
- Ao reconectar, solicitar ou receber novamente o estado atual do canal.
- Manter ultimo texto visivel durante queda temporaria, se essa for a regra escolhida.
- Opcionalmente limpar texto apos timeout configuravel de desconexao.
- Evitar flashes visuais durante reconexao.
- Registrar estado de conexao de forma discreta para debug, sem aparecer no vMix em producao.

## Fora de escopo

- Trocar Socket.IO por outro protocolo.
- Adicionar fallback polling, a menos que haja necessidade real.

## Criterios de aceite

- Reiniciar o backend nao deixa o display travado indefinidamente.
- Display volta a mostrar o estado correto apos reconectar.
- Nao ha reload manual necessario no vMix em caso comum de reconexao.
- Comportamento durante queda fica documentado.
