# Protocol Overview

## Visao geral

O projeto usa `src/protocol/` como fonte unica da verdade para a comunicacao entre app e IHM/ESP32.

Camadas:

```text
UI -> store -> device-service -> transports -> protocol -> IHM
```

Objetivo:

- padronizar topicos MQTT
- padronizar payloads
- manter HTTP local coerente com MQTT
- permitir simulacao com o mesmo modelo

## Schema

- schema atual: `axon.ihm.v1`
- arquivo base: `src/protocol/common.ts`

Campos comuns de mensagem:

- `schema`
- `deviceId`
- `timestamp`
- `source`

Valores comuns de `source`:

- `app`
- `ihm`
- `simulation`

## Topicos MQTT

Arquivo:

- `src/protocol/mqttTopics.ts`

Padrao:

```text
{topicPrefix}/{deviceId}/status
{topicPrefix}/{deviceId}/state
{topicPrefix}/{deviceId}/capabilities
{topicPrefix}/{deviceId}/commands
{topicPrefix}/{deviceId}/events
{topicPrefix}/{deviceId}/errors
{topicPrefix}/{deviceId}/schedules
```

Helpers:

- `buildMqttTopics`
- `getStatusTopic`
- `getStateTopic`
- `getCapabilitiesTopic`
- `getCommandsTopic`
- `getEventsTopic`
- `getErrorsTopic`
- `getSchedulesTopic`
- `detectMqttTopicKey`

## Comandos

Arquivo:

- `src/protocol/commandTypes.ts`

Tipos suportados:

- `power-on`
- `power-off`
- `set-frequency`
- `set-pump`
- `set-swing`
- `run-drain`
- `stop-drain`
- `request-status`
- `request-capabilities`
- `sync-schedules`

Formato:

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

Ack sugerido:

```json
{
  "schema": "axon.ihm.v1",
  "deviceId": "esp32-clima-001",
  "timestamp": "2026-04-22T14:00:05.000Z",
  "source": "ihm",
  "id": "cmd-002",
  "type": "set-frequency",
  "accepted": true,
  "applied": true,
  "status": "applied",
  "state": {
    "deviceOnline": true,
    "connectionMode": "cloud",
    "inverterRunning": true,
    "freqCurrentHz": 34,
    "freqTargetHz": 40,
    "pumpState": "on",
    "swingState": "off",
    "drainState": "off",
    "waterLevelState": "ok",
    "lastSeen": "2026-04-22T14:00:05.000Z",
    "lastCommandStatus": "applied",
    "lastErrorCode": null,
    "readyState": "running"
  },
  "error": null
}
```

Helpers de serializacao e parsing:

- `src/protocol/serialization.ts`

Funcoes principais:

- `serializeProtocolPayload`
- `parseStatusPayload`
- `parseStatePayload`
- `parseCapabilitiesPayload`
- `parseCommandMessage`
- `parseCommandAckPayload`
- `parseSchedulesPayload`
- `parseEventsPayload`
- `parseErrorsPayload`
- `parseDiagnosticsPayload`

## Estado e capacidades

Arquivos:

- `src/protocol/deviceState.ts`
- `src/protocol/deviceCapabilities.ts`

Campos de estado:

- `deviceOnline`
- `connectionMode`
- `inverterRunning`
- `freqCurrentHz`
- `freqTargetHz`
- `pumpState`
- `swingState`
- `drainState`
- `waterLevelState`
- `lastSeen`
- `lastCommandStatus`
- `lastErrorCode`
- `readyState`

Campos de capacidade:

- `fMinHz`
- `fMaxHz`
- `pumpAvailable`
- `swingAvailable`
- `drainAvailable`
- `waterSensorEnabled`
- `drainMode`
- `drainTimeSec`
- `drainReturnDelaySec`
- `pumpLogicMode`
- `waterSensorMode`
- `preWetSec`
- `dryPanelSec`
- `dryPanelFreqHz`
- `resumeMode`
- `autoResetMode`

## Schedules

Arquivo:

- `src/protocol/scheduleContract.ts`

Tipos:

- `power-on`
- `power-off`
- `drain-cycle`

Recorrencias:

- `one-shot`
- `daily`
- `weekly`

Formato:

```json
{
  "schema": "axon.ihm.v1",
  "deviceId": "esp32-clima-001",
  "timestamp": "2026-04-22T14:00:09.000Z",
  "source": "app",
  "revision": "local-001",
  "schedules": [
    {
      "id": "sch-001",
      "deviceId": "esp32-clima-001",
      "type": "power-on",
      "recurrence": "daily",
      "enabled": true,
      "time": "07:30",
      "daysOfWeek": [1, 2, 3, 4, 5],
      "oneShotDate": null,
      "createdAt": "2026-04-22T13:00:00.000Z",
      "updatedAt": "2026-04-22T13:30:00.000Z"
    }
  ]
}
```

## API local

Arquivo:

- `src/protocol/localApiContract.ts`

Endpoints:

- `GET /api/v1/status`
- `GET /api/v1/state`
- `GET /api/v1/capabilities`
- `POST /api/v1/commands`
- `GET /api/v1/events`
- `GET /api/v1/errors`
- `GET/POST /api/v1/schedules`
- `GET /api/v1/diagnostics`
- `GET /api/v1/ping`

Regra importante:

- os modelos retornados pela API local seguem os mesmos contratos conceituais do MQTT

## Simulacao

Arquivos:

- `src/services/transports/simulation-transport.ts`
- `src/services/transports/simulation-engine.ts`

O simulador:

- usa `DeviceCommandMessage`
- respeita enums e estados centrais
- gera eventos e comandos no mesmo formato conceitual esperado da integracao real
- faz round-trip de serializacao e parsing com os contratos oficiais antes de atualizar a store

## Exemplos JSON concretos

Arquivos:

- `docs/protocol-json/status.example.json`
- `docs/protocol-json/state.example.json`
- `docs/protocol-json/capabilities.example.json`
- `docs/protocol-json/command.power-on.example.json`
- `docs/protocol-json/command.power-off.example.json`
- `docs/protocol-json/command.set-frequency.example.json`
- `docs/protocol-json/command.pump-on.example.json`
- `docs/protocol-json/command.pump-off.example.json`
- `docs/protocol-json/command.swing-on.example.json`
- `docs/protocol-json/command.swing-off.example.json`
- `docs/protocol-json/command.start-drain.example.json`
- `docs/protocol-json/schedules.example.json`
- `docs/protocol-json/events.example.json`
- `docs/protocol-json/errors.example.json`

## Estruturas prontas para reutilizar no firmware ESP-IDF

O firmware pode reaproveitar a mesma organizacao conceitual de:

- envelope comum de mensagem
- topicos MQTT
- tipos de comando
- contratos de estado e capacidades
- ack de comando
- eventos e erros
- schedules
- equivalencia entre MQTT e API local

## Arquivos tecnicos mais importantes

1. `src/protocol/index.ts`
2. `src/services/device-service.ts`
3. `src/services/transports/mqtt-websocket-transport.ts`
4. `src/services/transports/local-http-transport.ts`
5. `src/store/app-store.tsx`
