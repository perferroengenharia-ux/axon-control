# Protocol JSON Examples

Arquivos disponiveis:

- `status.example.json`
- `state.example.json`
- `capabilities.example.json`
- `command.power-on.example.json`
- `command.power-off.example.json`
- `command.set-frequency.example.json`
- `command.pump-on.example.json`
- `command.pump-off.example.json`
- `command.swing-on.example.json`
- `command.swing-off.example.json`
- `command.start-drain.example.json`
- `schedules.example.json`
- `events.example.json`
- `errors.example.json`

Esses arquivos seguem o mesmo schema usado em `src/protocol/` e podem ser reaproveitados em:

- firmware ESP-IDF
- testes de integracao
- mocks de broker MQTT
- mocks da API local
- validacao manual de payloads
