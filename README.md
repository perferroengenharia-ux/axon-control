# Axon Control

Aplicativo universal em Expo + React Native + TypeScript para Android, iOS e web, focado no controle de climatizadores conectados a uma IHM com ESP32-S3-WROOM-1. O app conversa com a IHM, e a IHM intermedeia a comunicacao com o modulo inversor via RS485/UART.

Esta segunda fase fortaleceu a base existente sem recriar o projeto do zero. O app agora ficou mais padronizado para integracao futura com firmware ESP-IDF, com protocolo centralizado, transportes mais consistentes e interface em base escura.

## O que o projeto entrega

- Dashboard, controle, agendamentos, conexao, diagnostico e onboarding
- Cadastro de multiplos climatizadores com dispositivo ativo e favoritos
- Persistencia local de dispositivos, preferncias e agendamentos
- Credenciais sensiveis em `expo-secure-store` quando disponivel
- MQTT cloud via WebSocket/WSS
- Fallback local via HTTP + polling leve
- Modo simulacao usando os mesmos modelos de protocolo
- Dark theme mantendo `#3143BB` e `#81C34D` como cores principais

## Arquitetura revisada

```text
app/
  (tabs)/
  device/
src/
  components/
  features/
  mocks/
  protocol/
  services/
    contracts/
    storage/
    transports/
    device-service.ts
  store/
  theme/
  types/
  utils/
docs/
  protocol-overview.md
```

### Responsabilidades

- `src/protocol/`
  Fonte unica da verdade para topicos MQTT, payloads, enums, endpoints locais, estruturas de schedules e exemplos.
- `src/services/device-service.ts`
  Camada de aplicacao do dispositivo. Monta comandos padronizados, cria registros locais de comando e converte payloads de protocolo em patches para o estado global.
- `src/services/transports/`
  Adaptadores de transporte. MQTT cloud, HTTP local e simulacao usam a mesma base de protocolo.
- `src/store/app-store.tsx`
  Estado global, persistencia, sessoes por dispositivo e regras de negocio da UI.
- `src/types/`
  Modelos da aplicacao. O que e de protocolo e reaproveitado de `src/protocol`.
- `src/theme/`
  Tokens visuais e tema dark.

Observacao:

- `src/services/contracts/` foi mantido como camada de compatibilidade, mas a fonte real de verdade passou a ser `src/protocol/`.

## Pasta de protocolo

Arquivos principais:

- `src/protocol/mqttTopics.ts`
- `src/protocol/commandTypes.ts`
- `src/protocol/deviceCapabilities.ts`
- `src/protocol/deviceState.ts`
- `src/protocol/scheduleContract.ts`
- `src/protocol/localApiContract.ts`
- `src/protocol/messages.ts`
- `src/protocol/serialization.ts`
- `src/protocol/protocolExamples.ts`

### Topicos MQTT

Padrao centralizado:

```text
{topicPrefix}/{deviceId}/status
{topicPrefix}/{deviceId}/state
{topicPrefix}/{deviceId}/capabilities
{topicPrefix}/{deviceId}/commands
{topicPrefix}/{deviceId}/events
{topicPrefix}/{deviceId}/errors
{topicPrefix}/{deviceId}/schedules
```

Helpers principais:

- `buildMqttTopics(topicPrefix, deviceId)`
- `getStatusTopic(deviceId, topicPrefix)`
- `getStateTopic(deviceId, topicPrefix)`
- `getCapabilitiesTopic(deviceId, topicPrefix)`
- `getCommandsTopic(deviceId, topicPrefix)`
- `getEventsTopic(deviceId, topicPrefix)`
- `getErrorsTopic(deviceId, topicPrefix)`
- `getSchedulesTopic(deviceId, topicPrefix)`
- `detectMqttTopicKey(topics, topic)`

### Payloads padronizados

Comando enviado pelo app:

```json
{
  "schema": "axon.ihm.v1",
  "deviceId": "esp32-clima-001",
  "timestamp": "2026-04-22T14:00:04.000Z",
  "source": "app",
  "id": "cmd-002",
  "type": "set-frequency",
  "payload": {
    "freqTargetHz": 40
  }
}
```

Estado retornado pela IHM:

```json
{
  "schema": "axon.ihm.v1",
  "deviceId": "esp32-clima-001",
  "timestamp": "2026-04-22T14:00:01.000Z",
  "source": "ihm",
  "state": {
    "deviceOnline": true,
    "connectionMode": "cloud",
    "inverterRunning": true,
    "freqCurrentHz": 34,
    "freqTargetHz": 36,
    "pumpState": "on",
    "swingState": "off",
    "drainState": "off",
    "waterLevelState": "ok",
    "lastSeen": "2026-04-22T14:00:01.000Z",
    "lastCommandStatus": "applied",
    "lastErrorCode": null,
    "readyState": "running"
  }
}
```

Capacidades operacionais:

```json
{
  "schema": "axon.ihm.v1",
  "deviceId": "esp32-clima-001",
  "timestamp": "2026-04-22T14:00:02.000Z",
  "source": "ihm",
  "capabilities": {
    "fMinHz": 18,
    "fMaxHz": 60,
    "pumpAvailable": true,
    "swingAvailable": true,
    "drainAvailable": true,
    "waterSensorEnabled": true,
    "drainMode": "timed",
    "drainTimeSec": 45,
    "drainReturnDelaySec": 15,
    "pumpLogicMode": "linked",
    "waterSensorMode": "normal",
    "preWetSec": 8,
    "dryPanelSec": 20,
    "dryPanelFreqHz": 22,
    "resumeMode": "resume-last-state",
    "autoResetMode": "enabled"
  }
}
```

Mais exemplos editaveis:

- `src/protocol/protocolExamples.ts`
- `docs/protocol-json/`

### Helpers de serializacao e parsing

Arquivo principal:

- `src/protocol/serialization.ts`

Helpers principais:

- `serializeProtocolPayload(payload, pretty?)`
- `parseStatusPayload(input)`
- `parseStatePayload(input)`
- `parseCapabilitiesPayload(input)`
- `parseCommandMessage(input)`
- `parseCommandAckPayload(input)`
- `parseSchedulesPayload(input)`
- `parseEventsPayload(input)`
- `parseErrorsPayload(input)`
- `parseDiagnosticsPayload(input)`

Esses helpers podem ser reaproveitados em:

- testes de integracao
- mocks locais
- validacao de payloads antes de publicar no broker
- ferramentas auxiliares do firmware

## Como MQTT e local seguem o mesmo contrato

### Cloud MQTT

Fluxo:

```text
App <-> Broker MQTT <-> IHM/ESP32 <-> MI/STM32
```

Arquivos principais:

- `src/protocol/mqttTopics.ts`
- `src/services/transports/mqtt-websocket-transport.ts`

Decisao:

- MQTT via `ws`/`wss`
- melhor compatibilidade com web
- menos risco multiplataforma do que TCP cru

### Fallback local Wi-Fi

Fluxo:

```text
App <-> HTTP local da IHM/ESP32
```

Arquivos principais:

- `src/protocol/localApiContract.ts`
- `src/services/transports/local-http-transport.ts`

Endpoints centrais:

- `/api/v1/status`
- `/api/v1/state`
- `/api/v1/capabilities`
- `/api/v1/commands`
- `/api/v1/events`
- `/api/v1/errors`
- `/api/v1/schedules`
- `/api/v1/diagnostics`
- `/api/v1/ping`

Ponto importante:

- os modelos de `status`, `state`, `capabilities`, `events`, `errors` e `schedules` sao os mesmos conceitos usados no MQTT
- o que muda e o transporte, nao o contrato

Observacao para web:

- a IHM precisa responder com CORS habilitado quando o app web usar o modo local

## Modo simulacao

O simulador foi alinhado aos mesmos contratos centrais.

Isso significa:

- comandos simulados usam `DeviceCommandMessage`
- snapshots usam os mesmos enums de estado/capacidade
- o simulador cobre dashboard, controle, agendamentos, conexao e diagnostico
- a simulacao ajuda a testar a futura integracao sem criar formatos paralelos

Arquivos principais:

- `src/services/transports/simulation-transport.ts`
- `src/services/transports/simulation-engine.ts`
- `src/mocks/defaults.ts`

Validacao pratica:

- a simulacao agora gera payloads no schema oficial, serializa, faz parse e so depois converte de volta em patch para a store
- isso reduz o risco de existir uma simulacao "parecida", mas incompatível com a integracao real

## Decisoes visuais da segunda fase

- fundo geral mais escuro
- superficies em camadas escuras diferentes
- textos claros com contraste melhor
- `#3143BB` continua como cor principal
- `#81C34D` continua como destaque/sucesso/acao secundaria
- identidade anterior foi preservada, sem trocar fontes nem refazer layout do zero

Arquivos principais:

- `src/theme/tokens.ts`
- `src/theme/index.ts`
- componentes base em `src/components/`

## Como rodar

Instale dependencias:

```bash
npm install
```

Android:

```bash
npm run android
```

iOS:

```bash
npm run ios
```

Web:

```bash
npm run web
```

## Como usar o modo simulacao

Voce pode:

1. abrir o app e usar o dispositivo simulado carregado no primeiro boot
2. ir em `Dispositivos` > `Adicionar` > `Criar climatizador simulado`

## Como cadastrar um climatizador

Fluxo principal:

1. abra `Dispositivos`
2. toque em `Adicionar`
3. escolha:
   - Wi-Fi da IHM
   - rede local
   - host/IP manual
   - simulacao
4. leia os dados basicos
5. defina nome, local e observacoes
6. configure cloud/local
7. salve

## Arquivos para entender a base nova

Ordem recomendada:

1. `src/protocol/index.ts`
2. `src/protocol/mqttTopics.ts`
3. `src/protocol/commandTypes.ts`
4. `src/protocol/localApiContract.ts`
5. `src/services/device-service.ts`
6. `src/services/transports/mqtt-websocket-transport.ts`
7. `src/services/transports/local-http-transport.ts`
8. `src/services/transports/simulation-engine.ts`
9. `src/store/app-store.tsx`
10. `src/theme/tokens.ts`

## O que mudou nesta segunda fase

- criacao de `src/protocol` como fonte unica da verdade
- padronizacao de topicos MQTT e helpers dedicados
- padronizacao de payloads de comando, estado, capacidades, erros, eventos e schedules
- exemplos JSON concretos e reutilizaveis em `docs/protocol-json/`
- helpers de serializacao e parsing em `src/protocol/serialization.ts`
- separacao entre comando de protocolo e registro local de comando
- camada `device-service` para reduzir acoplamento entre UI e transporte
- merge de schedules por dispositivo para facilitar sincronizacao futura
- simulacao usando os mesmos modelos centrais
- base visual convertida para dark theme

## Persistencia e seguranca

Persistidos localmente:

- climatizadores cadastrados
- dispositivo ativo
- agendamentos
- preferencias do app

Tratamento de dados sensiveis:

- senhas MQTT e senha do AP da IHM ficam separadas do payload comum
- `expo-secure-store` e usado quando a plataforma permite

## Validacoes executadas

- `npx tsc --noEmit`
- `npm run lint`
- `npx expo-doctor`
- `npx expo export --platform web`

Resultado:

- tipagem sem erros
- lint sem avisos
- checagens do Expo aprovadas
- exportacao web concluida com sucesso em `dist/`

## Integracao futura com ESP-IDF

O app ficou preparado para a integracao futura porque:

- topicos e payloads nao estao mais espalhados
- o protocolo esta documentado e exemplificado
- MQTT, local e simulacao falam a mesma linguagem
- a UI depende mais de `DeviceSnapshot` e menos do detalhe do transporte

Estruturas que podem ser reaproveitadas diretamente no firmware ESP-IDF:

- envelope comum com `schema`, `deviceId`, `timestamp` e `source`
- montagem de topicos MQTT por `topicPrefix` + `deviceId`
- contratos de `status`, `state` e `capabilities`
- contratos de `commands` e `command ack`
- contratos de `events` e `errors`
- contrato de `schedules`
- equivalencia entre canais MQTT e endpoints locais

Documentacao complementar:

- `docs/protocol-overview.md`
