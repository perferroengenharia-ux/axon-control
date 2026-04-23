# Correcao de Rotinas e Schedules

## Resumo

Esta correcao ajusta a cadeia completa de agendamentos entre o app e o firmware da IHM:

- corrige a exibicao de horario no app
- padroniza o modelo de horario enviado no payload de `schedules`
- alinha o `deviceId` do protocolo com o `deviceId` real da IHM
- faz o ESP32 persistir e restaurar as rotinas
- adiciona um scheduler real no firmware
- dispara a logica real da IHM quando a rotina vence
- evita loop MQTT no topico de `schedules`

## Causas raiz

### 1. Horario errado no app

O horario exibido em `Atualizado em ...` estava sendo mostrado a partir da string ISO UTC crua, usando corte de texto em vez de conversao de timezone. Na pratica:

- a rotina era salva com `updatedAt` em UTC, por exemplo `2026-04-23T15:32:00.000Z`
- a UI cortava a string e mostrava `2026-04-23 15:32`
- o usuario esperava ver o horario local de Sao Paulo, `12:32`

### 2. Schedules nao executados no firmware

O firmware recebia o payload no topico MQTT de `schedules`, mas nao tinha um scheduler interno integrado ao relogio real e nem chamava a logica real da IHM para executar a acao.

Tambem havia um risco adicional: como o firmware assina e publica no mesmo topico de `schedules`, ele podia consumir o proprio snapshot publicado e entrar em reprocessamento desnecessario.

### 3. Inconsistencia de `deviceId` entre app e protocolo

No app, cada rotina precisa continuar ligada ao ID local do climatizador para persistencia e filtro de tela. Porem, no protocolo MQTT/HTTP o campo `deviceId` precisa representar o `deviceId` real da IHM.

Sem essa traducao, o round-trip dos schedules podia ficar inconsistente entre app e firmware.

## Modelo de horario adotado

### Horario funcional da rotina

Para agendamentos diarios, semanais e unicos, o horario funcional continua sendo tratado como horario local:

- `time`: string local no formato `HH:MM`
- `oneShotDate`: string local no formato `AAAA-MM-DD`

Esses campos sao os que controlam a execucao real da rotina.

### Metadados

Os campos:

- `createdAt`
- `updatedAt`

continuam em ISO UTC, porque funcionam melhor como metadados de sincronizacao e auditoria.

### Contexto de timezone enviado para o firmware

O app agora envia junto com `schedules`:

- `timezone`
- `timezoneOffsetMinutes`

O firmware usa principalmente `timezoneOffsetMinutes` para transformar o tempo UTC sincronizado por SNTP em horario local para avaliar as rotinas.

Como reforco de robustez, o firmware tambem consegue ajustar o relogio UTC a partir do `timestamp` do payload de schedules enviado pelo app. Isso evita que as rotinas fiquem bloqueadas caso o SNTP ainda nao tenha sincronizado, mesmo com MQTT ja funcionando.

Observacao:

- nesta fase, a execucao usa o offset numerico persistido no ultimo sync de schedules
- isso atende bem ao caso atual
- o campo `timezone` fica salvo para futura evolucao mais avancada

## Fluxo final de schedules

1. O usuario cria ou edita a rotina no app.
2. O app salva a rotina localmente.
3. O app traduz o `deviceId` local para o `deviceId` real da IHM e publica o payload em `{topicPrefix}/{deviceId}/schedules`.
4. O firmware recebe o payload, valida e persiste na NVS.
5. O scheduler interno consulta o horario atual sincronizado via SNTP.
6. Quando uma rotina fica elegivel, o firmware gera um comando interno.
7. Esse comando chama a mesma logica real ja usada pelos comandos MQTT/manuais da IHM.
8. O firmware publica o novo snapshot de estado.
9. O app recebe o estado atualizado normalmente pela telemetria MQTT.

## O que foi alterado no app

### Arquivos principais

- `C:\Users\murilo\axon-control\app\(tabs)\schedules.tsx`
- `C:\Users\murilo\axon-control\src\features\schedules\schedule-editor-modal.tsx`
- `C:\Users\murilo\axon-control\src\services\device-service.ts`
- `C:\Users\murilo\axon-control\src\services\transports\mqtt-websocket-transport.ts`
- `C:\Users\murilo\axon-control\src\services\transports\local-http-transport.ts`
- `C:\Users\murilo\axon-control\src\protocol\scheduleContract.ts`
- `C:\Users\murilo\axon-control\src\protocol\serialization.ts`
- `C:\Users\murilo\axon-control\src\utils\date.ts`

### Ajustes feitos

- a tela de agendamentos passou a usar `formatDateTime()` para exibir `updatedAt` em horario local
- o payload de schedules passou a incluir `timezone` e `timezoneOffsetMinutes`
- o app passou a traduzir `Schedule.deviceId` entre o ID local do cadastro e o `deviceId` real da IHM usado no protocolo
- a tela passou a mostrar os dias semanais com rotulos amigaveis (`Dom`, `Seg`, `Ter`...)
- os textos da tela foram ajustados para refletir sincronizacao real com a IHM, e nao apenas cadastro local

## O que foi alterado no firmware

### Arquivos principais

- `C:\Users\murilo\Downloads\IHM_final-main\include\app_config.h`
- `C:\Users\murilo\Downloads\IHM_final-main\include\app_types.h`
- `C:\Users\murilo\Downloads\IHM_final-main\include\protocol_json.h`
- `C:\Users\murilo\Downloads\IHM_final-main\include\schedule_manager.h`
- `C:\Users\murilo\Downloads\IHM_final-main\include\time_sync.h`
- `C:\Users\murilo\Downloads\IHM_final-main\src\main.c`
- `C:\Users\murilo\Downloads\IHM_final-main\src\mqtt_manager.c`
- `C:\Users\murilo\Downloads\IHM_final-main\src\protocol_json.c`
- `C:\Users\murilo\Downloads\IHM_final-main\src\schedule_manager.c`
- `C:\Users\murilo\Downloads\IHM_final-main\src\time_sync.c`
- `C:\Users\murilo\Downloads\IHM_final-main\src\wifi_manager.c`

### Ajustes feitos

- criadas estruturas internas para armazenar `app_schedule_t` e `app_schedule_store_t`
- implementado parsing de payload MQTT de schedules
- implementada serializacao de snapshot de schedules
- adicionado armazenamento em NVS dos schedules
- adicionada restauracao de schedules no boot
- adicionado sincronismo de horario via SNTP
- adicionado ajuste complementar de hora a partir do `timestamp` do payload enviado pelo app
- adicionado calculo de horario local com base em UTC + `timezoneOffsetMinutes`
- criado `schedule_manager` com task periodica de verificacao
- implementado suporte real a:
  - `one-shot`
  - `daily`
  - `weekly`
- adicionada protecao contra repeticao indevida no mesmo minuto com `last_trigger_key`
- rotinas `one-shot` passam a ser desabilitadas apos o disparo
- a rotina agora chama `ihm_mqtt_adapter_execute_command(...)`, que ja esta ligado a logica real da IHM
- o firmware republica `state` apos executar uma rotina
- o firmware passou a ignorar snapshots de schedules publicados por ele mesmo para evitar loop MQTT
- o `deviceId` raiz do payload passou a ser tratado como identificador canonico do conjunto de schedules

## Como a rotina dispara a logica real da IHM

O scheduler nao altera apenas variaveis paralelas.

Quando uma rotina vence, ele monta um `app_command_t` interno e chama:

- `ihm_mqtt_adapter_execute_command(...)`

Essa ponte reaproveita o fluxo real da IHM:

- `power-on` usa o mesmo fluxo do liga/desliga real
- `power-off` usa o mesmo fluxo do liga/desliga real
- `drain-cycle` usa o fluxo real de dreno ja existente

Isso evita duplicacao de logica e mantem uma unica fonte de verdade para o comportamento do equipamento.

## Regras implementadas no scheduler

- so executa quando o relogio SNTP ja estiver valido
- ignora rotinas desabilitadas
- respeita `one-shot`, `daily` e `weekly`
- usa `tm_wday` compativel com o app (`0 = domingo`)
- evita repetir a mesma rotina varias vezes no mesmo minuto
- persiste o estado das rotinas apos alteracao relevante

## Topico MQTT usado

Topico de rotinas:

- `{topicPrefix}/{deviceId}/schedules`

Exemplo atual:

- `axon/ihm/ihm32-AB18F0/schedules`

## Como testar

### 1. Teste de timezone no app

1. Abra a tela de agendamentos.
2. Crie uma rotina para um horario local conhecido, por exemplo `12:32`.
3. Salve a rotina.
4. Confirme se `Atualizado em ...` aparece no horario local correto, sem somar `+3h`.

### 2. Teste de power-on

1. Configure uma rotina `Ligar` para 1 ou 2 minutos a frente.
2. Confirme no serial que o ESP recebeu e salvou os schedules.
3. Aguarde o horario.
4. Verifique no serial um log de schedule elegivel/executado.
5. Confirme se a IHM realmente ligou.
6. Confirme se o app recebeu o novo estado.

### 3. Teste de power-off

1. Deixe o equipamento ligado.
2. Crie uma rotina `Desligar` para alguns minutos a frente.
3. Aguarde o horario.
4. Verifique a mudanca real de estado na IHM e no app.

### 4. Teste de drain

1. Garanta que o dispositivo tenha `drainAvailable = true`.
2. Crie uma rotina `Dreno`.
3. Aguarde o horario.
4. Confirme no serial e no comportamento do equipamento que o dreno foi acionado pelo fluxo real.

### 5. Teste semanal

1. Crie uma rotina semanal.
2. Marque o dia atual.
3. Programe para alguns minutos a frente.
4. Confirme que ela executa somente no dia marcado.

### 6. Teste diario

1. Crie uma rotina diaria.
2. Programe para alguns minutos a frente.
3. Confirme o disparo.
4. Verifique que ela nao executa repetidamente varias vezes dentro do mesmo minuto.

## Logs esperados no firmware

Exemplos de logs uteis apos a correcao:

- scheduler aguardando hora valida via SNTP
- hora valida detectada; scheduler habilitado
- schedules recebidos e salvos
- schedule salvo: ...
- schedule elegivel para execucao: ...
- schedule executado: ...
- snapshot de schedules publicado pela propria IHM ignorado para evitar loop MQTT

## Validacao executada nesta correcao

- app: `npx tsc --noEmit`
- app: `npm run lint`
- firmware: `pio run` em `C:\Users\murilo\Downloads\IHM_final-main`

## Limitacoes atuais

- o firmware usa o `timezoneOffsetMinutes` persistido no ultimo sync de schedules; isso e suficiente para o caso atual, mas ainda nao faz resolucao completa de regras historicas de timezone/DST a partir do nome da timezone
- a confirmacao de execucao de rotina acontece pelo novo `state` publicado e pelos logs; nao foi criado um canal separado de historico de disparos nesta fase
