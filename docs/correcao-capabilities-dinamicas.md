# Correcao de Capabilities Dinamicas

## Resumo

Esta correcao faz o sistema tratar `capabilities` como dado dinamico, e nao apenas como snapshot de handshake.

Depois dela:

- o app continua recebendo o snapshot inicial normalmente
- o firmware republica `capabilities` e `state` quando parametros operacionais mudam localmente na IHM
- o app aplica esses updates na store sem precisar reiniciar
- a UI reage em tempo real a mudancas de:
  - dreno
  - swing
  - `fMinHz`
  - `fMaxHz`
  - demais capacidades operacionais usadas pela interface

## Causa raiz

### No app

O app ja assinava o topico de `capabilities` e ja fazia merge na store. Ou seja, o problema principal nao era a ausencia de suporte a updates dinamicos no lado do app.

Os dois pontos reais no app eram:

1. faltava diagnostico claro para diferenciar snapshot inicial de update posterior
2. o campo local de frequencia na tela de controle podia continuar com um valor digitado antigo mesmo depois de `fMinHz` ou `fMaxHz` mudarem

### No firmware

O firmware cloud publicava `capabilities` basicamente em dois momentos:

- no snapshot inicial ao conectar no MQTT
- quando recebia um comando explicito de `request-capabilities`

Quando o operador alterava parametros diretamente na IHM durante a operacao, a logica interna passava a obedecer os novos valores, mas o firmware nao republicava `capabilities` automaticamente.

Resultado:

- a IHM ficava com as regras novas
- o app continuava com os limites/capacidades antigos
- o app parecia “travado no handshake inicial”

## Como funcionava antes

### Cloud MQTT

- handshake inicial publicava `status`, `state`, `capabilities` e `schedules`
- depois disso, `state` continuava sendo publicado periodicamente
- `capabilities` nao era republicado quando um parametro operacional mudava localmente na IHM

### Fallback local

O modo local HTTP ja fazia polling dos endpoints, incluindo `capabilities`, entao ele ja era mais dinamico por natureza.

## Como passou a funcionar

### Firmware

Quando a IHM altera localmente um parametro que impacta a interface do app, o firmware marca o snapshot de `capabilities` como “sujo”.

Depois que a logica local termina de processar o evento de botao/menu e libera o lock de controle, o firmware:

1. publica `capabilities` atualizadas
2. publica `state` atualizada

Isso foi feito sem criar fonte de verdade paralela. O firmware continua usando os mesmos parametros internos como origem real.

### App

O app continua assinando `capabilities`, mas agora:

- registra quando o snapshot inicial chega
- registra quando um update posterior muda campos reais
- atualiza `diagnostics.connectionSummary` com os campos alterados
- recalcula o campo local de frequencia quando `fMinHz` ou `fMaxHz` mudam

## Arquivos alterados

### App

- `C:\Users\murilo\axon-control\app\(tabs)\control.tsx`
- `C:\Users\murilo\axon-control\src\services\device-service.ts`
- `C:\Users\murilo\axon-control\src\services\transports\mqtt-websocket-transport.ts`
- `C:\Users\murilo\axon-control\src\services\transports\local-http-transport.ts`

### Firmware

- `C:\Users\murilo\Downloads\IHM_final-main\src\main.c`

## Detalhes da correcao

### 1. Publicacao dinamica no firmware

Foi criada uma deteccao de parametros operacionais que afetam `capabilities`, incluindo:

- `P12`
- `P20`
- `P21`
- `P30`
- `P31`
- `P32`
- `P44`
- `P80`
- `P81`
- `P82`
- `P83`
- `P84`
- `P85`

Quando um desses parametros e alterado localmente pela IHM:

- o firmware marca `capabilities` como sujo
- ao final do fluxo local, publica:
  - `capabilities`
  - `state`

Isso cobre casos como:

- habilitar dreno em tempo real
- habilitar/desabilitar swing
- mudar `fMinHz` e `fMaxHz`
- alterar parametros que mudam modos operacionais refletidos na UI

### 2. Reacao dinamica no app

No transporte MQTT do app:

- o payload de `capabilities` recebido e comparado com o snapshot atual
- o app registra quais campos mudaram
- a store recebe o valor mais novo e a UI rerenderiza

No fallback local HTTP:

- o polling de `capabilities` passa a registrar e resumir as mudancas detectadas

### 3. Campo de frequencia ajustado em tempo real

Na tela de controle:

- o slider ja usava `activeSnapshot.capabilities.fMinHz` e `fMaxHz`
- agora o campo numerico local tambem e reclampado quando esses limites mudam

Isso evita manter um valor visual antigo depois que a IHM reduziu ou aumentou os limites.

## Como os updates dinamicos sao recebidos e aplicados

### Cloud MQTT

1. a IHM publica no topico `.../capabilities`
2. o app recebe o payload
3. o app compara com `currentSnapshot.capabilities`
4. a store recebe o snapshot novo
5. a UI rerenderiza automaticamente

### Local HTTP

1. o app consulta periodicamente `/api/v1/capabilities`
2. compara com o snapshot anterior
3. atualiza a store quando houver diferenca
4. a UI rerenderiza automaticamente

## Como testar

### 1. Habilitar dreno durante a operacao

1. Conecte a IHM e o app.
2. Deixe o app aberto na tela de controle ou dashboard.
3. Na IHM, habilite o dreno localmente.
4. Confirme que:
   - o firmware publica `capabilities` novas
   - o app passa a mostrar/habilitar o controle de dreno

### 2. Alterar swing durante a operacao

1. Com o app conectado, altere o parametro de swing na IHM.
2. Confirme que o app atualiza a disponibilidade de swing sem reiniciar.

### 3. Alterar `fMinHz` e `fMaxHz`

1. Abra a tela de controle.
2. Mude os limites na IHM.
3. Confirme que o app atualiza:
   - faixa exibida
   - min/max do slider
   - valor aceito no campo numerico

### 4. Conferir logs no app

No console do app, procure mensagens como:

- `Snapshot inicial/reconfirmado de capabilities ...`
- `Capabilities atualizadas para ...: fMinHz, fMaxHz`
- `Capabilities locais atualizadas para ...`

### 5. Conferir logs no firmware

No serial do ESP, procure:

- `Parametros operacionais alterados localmente na IHM; publicando capabilities/state atualizados`

## Validacao executada

- app: `npm run lint`
- app: `npx tsc --noEmit`
- firmware: `pio run` em `C:\Users\murilo\Downloads\IHM_final-main`

## Resultado esperado

Agora o fluxo correto e:

- o operador muda um parametro na IHM
- o firmware republica `capabilities` e `state`
- o app recebe a nova versao
- a store substitui os valores antigos
- a UI reage sem reconexao manual

Isso elimina a divergencia entre:

- o que a IHM aceita de verdade
- o que o app mostra
- o que o app permite enviar
