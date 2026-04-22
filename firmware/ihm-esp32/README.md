# Firmware IHM ESP32-S3

Projeto de firmware da IHM baseado em `ESP32-S3-WROOM-1`, estruturado para `PlatformIO + ESP-IDF + C`, com foco em:

- comunicacao com o app via MQTT cloud
- fallback local via Wi-Fi com HTTP/JSON
- persistencia local com NVS
- OTA por HTTPS
- base preparada para futura integracao com o MI via RS485/UART

## O que ja esta funcional

- Boot principal com NVS, estado, capacidades, agendamentos e diagnostico
- Wi-Fi com STA + AP fallback
- Servidor local HTTP com contratos JSON
- Cliente MQTT com topicos centralizados
- Validacao e execucao de comandos
- Publicacao de `status`, `state`, `capabilities`, `events`, `errors` e `schedules`
- Persistencia de configuracoes e schedules em NVS
- Agendamentos locais com disparo basico
- OTA HTTPS com certificado CA configuravel

## O que ainda e stub

- Integracao real com o modulo inversor via RS485/UART
- Logica real da IHM para atuar sobre hardware fisico
- Confirmacao vinda do MI apos escrita real em registradores/parametros

O ponto de extensao principal para isso e:

- [src/rs485_bridge.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/rs485_bridge.c)

## Estrutura

```text
firmware/ihm-esp32/
|-- platformio.ini
|-- CMakeLists.txt
|-- partitions.csv
|-- sdkconfig.defaults
|-- include/
|   |-- app_config.h
|   |-- app_types.h
|   |-- app_state.h
|   |-- wifi_manager.h
|   |-- mqtt_manager.h
|   |-- local_server.h
|   |-- protocol.h
|   |-- protocol_topics.h
|   |-- protocol_json.h
|   |-- commands.h
|   |-- capabilities.h
|   |-- device_state.h
|   |-- schedules.h
|   |-- storage.h
|   |-- diagnostics.h
|   |-- ota.h
|   |-- certs.h
|   |-- rs485_bridge.h
|   |-- log_tags.h
|-- src/
|   |-- main.c
|   |-- app_state.c
|   |-- wifi_manager.c
|   |-- mqtt_manager.c
|   |-- local_server.c
|   |-- protocol.c
|   |-- protocol_topics.c
|   |-- protocol_json.c
|   |-- commands.c
|   |-- capabilities.c
|   |-- device_state.c
|   |-- schedules.c
|   |-- storage.c
|   |-- diagnostics.c
|   |-- ota.c
|   |-- rs485_bridge.c
```

## Como compilar

Na pasta [firmware/ihm-esp32](C:/Users/murilo/axon-control/firmware/ihm-esp32):

```bash
pio run
```

## Como gravar

```bash
pio run -t upload
```

Se sua placa custom exigir outro adaptador, velocidade ou porta serial, ajuste em [platformio.ini](C:/Users/murilo/axon-control/firmware/ihm-esp32/platformio.ini).

## Como monitorar a serial

```bash
pio device monitor
```

O monitor esta configurado inicialmente para `115200`.

## Board, framework e build

As definicoes principais ficam em [platformio.ini](C:/Users/murilo/axon-control/firmware/ihm-esp32/platformio.ini):

- `platform = espressif32`
- `board = esp32-s3-devkitc-1`
- `framework = espidf`

O build usa:

- [CMakeLists.txt](C:/Users/murilo/axon-control/firmware/ihm-esp32/CMakeLists.txt)
- [src/CMakeLists.txt](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/CMakeLists.txt)

## Onde ajustar primeiro

- [include/app_config.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/app_config.h)
  Ajuste defaults, limites, tamanhos de buffer, topic prefix e parametros gerais.
- [include/certs.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/certs.h)
  Cole o certificado CA real do broker MQTT e, se desejar, do OTA HTTPS.
- [src/app_state.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/app_state.c)
  Defaults de runtime, `deviceId`, AP fallback e carga de configuracao salva.
- [src/protocol_json.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol_json.c)
  Contratos JSON da comunicacao com o app.
- [src/commands.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/commands.c)
  Validacao de comandos e regras de negocio.
- [src/rs485_bridge.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/rs485_bridge.c)
  Entrada da futura integracao real com o MI.

## Como preencher o certs.h

Edite [include/certs.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/certs.h) e substitua o placeholder:

```c
static const char APP_ROOT_CA_PEM[] =
    "-----BEGIN CERTIFICATE-----\n"
    "REPLACE_WITH_REAL_CA_CERTIFICATE\n"
    "-----END CERTIFICATE-----\n";
```

Sem um PEM valido:

- MQTT TLS pode falhar
- OTA HTTPS pode falhar

## Como configurar Wi-Fi e MQTT

Nesta base, o firmware carrega configuracoes de:

- Wi-Fi STA/AP
- MQTT broker
- `topicPrefix`
- `deviceId`
- servidor local

Os dados saem de defaults em [include/app_config.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/app_config.h) e podem ser persistidos em NVS por:

- [src/storage.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/storage.c)
- [src/app_state.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/app_state.c)

Atualmente o projeto sobe com:

- AP fallback ativo por padrao
- MQTT desabilitado por padrao ate haver configuracao real

## Fluxo MQTT

Topicos montados em [src/protocol_topics.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol_topics.c):

- `{topicPrefix}/{deviceId}/status`
- `{topicPrefix}/{deviceId}/state`
- `{topicPrefix}/{deviceId}/capabilities`
- `{topicPrefix}/{deviceId}/commands`
- `{topicPrefix}/{deviceId}/events`
- `{topicPrefix}/{deviceId}/errors`
- `{topicPrefix}/{deviceId}/schedules`

Fluxo atual:

1. Wi-Fi sobe
2. MQTT conecta se estiver habilitado
3. Firmware faz subscribe em `commands` e `schedules`
4. Ao conectar, publica snapshot inicial
5. Ao receber comando, valida, aplica, registra diagnostico e republica estado

Arquivos principais:

- [src/mqtt_manager.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/mqtt_manager.c)
- [src/protocol.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol.c)
- [src/protocol_json.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol_json.c)

## Fluxo local Wi-Fi

Foi escolhida uma base simples e estavel com `HTTP REST + JSON`, compatível com mobile e web.

Rotas:

- `GET /api/v1/ping`
- `GET /api/v1/status`
- `GET /api/v1/state`
- `GET /api/v1/capabilities`
- `POST /api/v1/commands`
- `GET /api/v1/schedules`
- `POST /api/v1/schedules`
- `GET /api/v1/diagnostics`
- `GET /api/v1/events`
- `GET /api/v1/errors`
- `POST /api/v1/ota`

Arquivos principais:

- [src/local_server.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/local_server.c)
- [src/protocol_json.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol_json.c)

## OTA

Fluxo OTA:

1. App ou API local envia URL HTTPS
2. Firmware valida entrada
3. OTA inicia em task separada
4. Status de OTA e diagnostico sao atualizados
5. Em sucesso, o ESP32 reinicia

Arquivos:

- [include/ota.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/ota.h)
- [src/ota.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/ota.c)

## Persistencia

Persistido em NVS:

- configuracao Wi-Fi
- configuracao MQTT
- configuracao do servidor local
- agendamentos

Arquivos:

- [include/storage.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/storage.h)
- [src/storage.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/storage.c)

## Agendamentos

O modulo atual suporta base para:

- `power-on`
- `power-off`
- `drain-cycle`

Com recorrencia:

- `one-shot`
- `daily`
- `weekly`

Arquivo principal:

- [src/schedules.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/schedules.c)

## Onde integrar o RS485 real

O modulo de stub atual e:

- [include/rs485_bridge.h](C:/Users/murilo/axon-control/firmware/ihm-esp32/include/rs485_bridge.h)
- [src/rs485_bridge.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/rs485_bridge.c)

Quando voce ligar o MI real:

1. inicialize UART/RS485 nesse modulo
2. traduza `app_command_t` para o protocolo do MI
3. leia resposta/confirmacao real do MI
4. reflita isso de volta em `device_state.c`
5. publique confirmacoes via `protocol.c`

## Arquivos para estudar primeiro

- [src/main.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/main.c)
- [src/app_state.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/app_state.c)
- [src/protocol.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol.c)
- [src/protocol_json.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/protocol_json.c)
- [src/commands.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/commands.c)
- [src/mqtt_manager.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/mqtt_manager.c)
- [src/local_server.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/local_server.c)
- [src/rs485_bridge.c](C:/Users/murilo/axon-control/firmware/ihm-esp32/src/rs485_bridge.c)

## Observacao honesta

Nesta maquina eu nao tenho `pio`, `platformio` nem `idf.py` instalados, entao nao consegui compilar localmente o firmware aqui dentro. A estrutura, os arquivos, os contratos e os modulos foram revisados, mas a validacao final de build precisa ser feita em um ambiente com PlatformIO/ESP-IDF instalado.
