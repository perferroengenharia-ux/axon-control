# Manual do Aplicativo

## 1. Apresentação do aplicativo

O aplicativo **Axon Control** foi feito para controlar climatizadores conectados a uma **IHM baseada em ESP32-S3**. O app **não fala diretamente com o módulo inversor**. Na implementação atual, ele conversa com a IHM por três caminhos:

- **Cloud MQTT** via WebSocket (`ws`) ou WebSocket seguro (`wss`)
- **Wi-Fi local** por HTTP
- **Modo simulação** para treino e testes sem hardware real

O projeto foi estruturado para **Android, iOS e web** com Expo + React Native + Expo Router.

Na prática, o app serve para:

- cadastrar mais de um climatizador
- escolher um climatizador ativo
- ligar e desligar
- ajustar a frequência alvo do inversor
- controlar bomba, swing e dreno
- acompanhar estado, água, erros e eventos
- cadastrar rotinas locais
- configurar conexão cloud, local ou simulação

### Importante sobre a implementação atual

- O projeto **não implementa Bluetooth**.
- O modo local usa **HTTP com polling leve**, não descoberta automática completa.
- O fluxo de **leitura de dados básicos no assistente de cadastro ainda é simulado/mockado**.
- O app já tenta usar MQTT e HTTP local de forma real, mas isso depende de a IHM responder aos contratos esperados.

### Comportamento no primeiro uso

Se não houver dados salvos no aparelho, o app inicia com **um climatizador simulado já cadastrado e ativo**. Isso permite explorar as telas sem hardware real.

---

## 2. Visão geral das telas

O app tem cinco abas principais e algumas telas auxiliares.

| Tela | Onde fica | Para que serve | O que existe hoje |
|---|---|---|---|
| **Dispositivos** | Aba principal | Gerenciar cadastros | Lista, seleção do ativo, favoritar, editar, remover, abrir conexão |
| **Dashboard** | Aba principal | Visão geral do climatizador ativo | Status, frequência atual/alvo, água, quick actions, periféricos, eventos, último erro |
| **Controle** | Aba principal | Comandos principais e periféricos | Liga/desliga, slider de frequência, campo numérico, bomba, swing, dreno, feedback do último comando |
| **Rotinas** | Aba principal | Cadastro de agendamentos | Criar, editar, pausar/ativar, excluir, com recorrência única/diária/semanal |
| **Diagnóstico** | Aba principal | Suporte técnico e comunicação | Teste de conexão, capacidades, histórico de comandos, eventos, firmware, último erro |
| **Adicionar climatizador** | Tela auxiliar | Assistente em 5 etapas | AP da IHM, rede local, host manual, simulação |
| **Editar climatizador** | Tela auxiliar | Ajustar identificação amigável | Nome, local, observações |
| **Conexão** | Tela auxiliar | Configurar cloud/local/simulação | Modo de comunicação, broker, deviceId, host/IP, porta, SSID/AP, testes |

### Como a navegação funciona

- A aba **Dispositivos** é o ponto de entrada mais importante.
- As abas **Dashboard**, **Controle**, **Rotinas** e **Diagnóstico** sempre trabalham com o **climatizador ativo**.
- As telas **Editar** e **Conexão** são abertas a partir do cartão do climatizador ou por atalhos nas telas principais.

---

## 3. Como adicionar um climatizador

Abra a aba **Dispositivos** e toque em **Adicionar**. O app abre o assistente **Adicionar climatizador**.

### Etapa 1. Escolha o método

As opções visíveis hoje são:

- **Conectar ao Wi-Fi da IHM**
- **Adicionar pela rede local**
- **Adicionar manualmente por IP/host**
- **Criar climatizador simulado**

### Etapa 2. Ler dados básicos

Dependendo do método escolhido:

- Para métodos reais, o app mostra os campos:
  - **Host ou IP local**
  - **Porta local**
  - **deviceId conhecido** (opcional)
- Para **simulação**, o app mostra um aviso e pede que você use **Tentar leitura** para gerar os dados simulados.

#### Como essa etapa funciona hoje

- O botão **Tentar leitura** existe e funciona na interface.
- **Nesta versão, a leitura é simulada/mockada**. Ela não conversa com a IHM real ainda.
- Se o texto de `host` ou `deviceId` contiver `fail`, o app simula uma falha de leitura.
- No método **Adicionar manualmente por IP/host**, o botão **Avançar** pode ser usado mesmo sem leitura concluída.
- Nos outros métodos, o assistente exige a leitura antes de avançar.

#### O que aparece quando a leitura “conclui”

O app pode preencher:

- `deviceId`
- nome padrão
- versão de firmware
- status da leitura
- capacidades iniciais

Esses dados são **placeholders da implementação atual**, úteis para montar o cadastro e testar a experiência.

### Etapa 3. Identificação amigável

Campos disponíveis:

- **Nome do climatizador**
- **Local / ambiente**
- **Observação**

Nesta etapa, o app realmente valida:

- nome obrigatório
- local/ambiente obrigatório

### Etapa 4. Provisionamento de rede e cloud

Campos que existem hoje:

- **WS / WSS**
- **Broker MQTT**
- **Porta MQTT**
- **Usuário MQTT**
- **Senha MQTT**
- **Prefixo de tópicos**
- **SSID do Wi-Fi da IHM**
- **Senha do Wi-Fi da IHM**

#### Importante

- Para métodos reais, o app também depende de **host/IP local** e **porta local**, informados na etapa 2.
- Os campos de cloud **não são obrigatórios em todos os casos**.
- Se você estiver montando um cadastro local e deixar cloud em branco, o app permite isso.
- No método **Simulação**, esses campos aparecem, mas **não são exigidos para salvar**.

### Etapa 5. Revisar e concluir

O app mostra um resumo com:

- nome
- `deviceId`
- local
- método
- broker e porta
- host local e porta
- prefixo de tópicos

Ao tocar em **Salvar climatizador**, o cadastro é gravado localmente.

### Como o modo inicial do climatizador é definido

Pelo código atual:

- **Conectar ao Wi-Fi da IHM** salva o climatizador com modo preferido **AP da IHM**
- **Adicionar pela rede local** salva com modo preferido **Auto**
- **Adicionar manualmente por IP/host** salva com modo preferido **Auto**
- **Criar climatizador simulado** salva com modo preferido **Simulação**

### Limitações atuais do cadastro

- O app **não troca a rede Wi-Fi do aparelho automaticamente**.
- O app **não faz descoberta automática completa na LAN**.
- O botão **Tentar leitura** ainda **não consulta hardware real**.
- Para usar o método **AP da IHM**, você ainda precisa conectar o celular/computador à rede da IHM manualmente, fora do app.

---

## 4. Como selecionar e gerenciar climatizadores

Na aba **Dispositivos**, cada climatizador aparece em um cartão com:

- nome
- local e `deviceId`
- status **Online** ou **Offline**
- modo de conexão
- estado pronto (`readyState`)
- frequência atual
- água
- última leitura
- frequência alvo
- erro recente

### Ações disponíveis no cartão

- **Selecionar** ou **Ativo**
- **Favoritar** ou **Desfavoritar**
- **Conexão**
- **Editar**
- **Remover**

### Como escolher o climatizador ativo

Toque em **Selecionar**. O botão muda para **Ativo** e esse climatizador passa a ser usado nas outras abas.

### Como editar nome e local

Toque em **Editar**. A tela **Editar climatizador** permite alterar:

- **Nome do climatizador**
- **Local / ambiente**
- **Observações**

Nessa tela:

- o `deviceId` aparece como campo somente leitura
- as credenciais e parâmetros de comunicação ficam fora dessa edição simples

### Como abrir as configurações de comunicação

Toque em **Conexão** no cartão do climatizador, ou use o atalho em **Dashboard**, **Editar** ou **Diagnóstico**.

### Como favoritar

Toque em **Favoritar**. O climatizador ganha o ícone de estrela. No estado atual do app:

- favoritar **não muda a ordem da lista**
- favoritar **não altera o climatizador ativo**

### Como remover

Toque em **Remover** e confirme.

No comportamento atual do app:

- o climatizador é removido do cadastro local
- os agendamentos associados a ele também são removidos
- se ele era o climatizador ativo, o app tenta selecionar outro cadastro restante

### Como entender Online e Offline

- **Online** significa que o transporte atual conseguiu confirmar comunicação recente.
- **Offline** significa que a IHM ainda não confirmou conectividade ou houve falha recente.

Para dispositivos reais recém-cadastrados, é normal começar como **Offline** até que o transporte consiga sincronizar.

---

## 5. Como controlar o climatizador

Abra a aba **Controle**.

### Liga / desliga

A tela mostra:

- se o climatizador está **Ligado** ou **Desligado**
- o **status do comando**
- o `readyState`

Botões disponíveis:

- **Ligar**
- **Desligar**

Quando o dispositivo está offline:

- os botões principais ficam desabilitados
- o app mostra um aviso explicando que ele não usa estado local otimista como verdade final

### Ajuste de frequência

A seção **Frequência do inversor** mostra:

- a faixa operacional confirmada pela IHM
- um **slider**
- um **campo numérico**
- o botão **Aplicar frequência**

O slider trabalha com:

- valor mínimo = `fMinHz`
- valor máximo = `fMaxHz`
- passo de **1 Hz**

### Como o limite mínimo e máximo são tratados

Pelo código atual, o app sempre faz **clamp** da frequência:

- se você tentar mandar abaixo de `fMinHz`, ele ajusta para o mínimo
- se tentar mandar acima de `fMaxHz`, ele ajusta para o máximo

### Confirmação de comando

O app usa os estados:

- `idle`
- `sending`
- `applied`
- `failed`

#### Comportamento atual por transporte

- **Cloud MQTT**: o comando pode ficar em `sending` até a IHM publicar estado/retorno pelo broker
- **Local HTTP**: o app tenta atualizar o status com base na resposta HTTP da IHM
- **Simulação**: o app simula o envio e a confirmação

### Quando a frequência pode não mudar na hora

Mesmo com o comando enviado:

- no modo cloud, o app espera confirmação pelo canal MQTT
- no modo simulação, a frequência atual sobe ou desce gradualmente até a frequência alvo
- se o dispositivo estiver offline, o envio é bloqueado

---

## 6. Como controlar periféricos

Na aba **Controle**, a seção **Periféricos** mostra:

- **Bomba**
- **Swing**
- **Dreno**

Cada cartão informa:

- estado atual
- descrição do recurso
- botão de ação

### Estados e ações visíveis

- **Bomba**: `Ligar bomba` ou `Desligar bomba`
- **Swing**: `Ligar swing` ou `Desligar swing`
- **Dreno**: `Executar dreno` ou `Parar dreno`

### Quando o controle fica desabilitado

O app bloqueia o uso quando a capacidade correspondente estiver desligada:

- `pumpAvailable = false`
- `swingAvailable = false`
- `drainAvailable = false`

Nesses casos, o botão mostra **Indisponível** e o cartão explica o motivo.

### Mensagens de indisponibilidade implementadas

- Bomba: **A bomba está desabilitada pelos parâmetros atuais da IHM.**
- Swing: **O swing não está disponível para este climatizador.**
- Dreno: **O dreno não está habilitado para este climatizador.**

### Importante sobre dispositivo offline

No estado atual da tela:

- a disponibilidade visual dos periféricos depende das **capacidades**
- a proteção final contra envio offline também acontece na **camada de domínio**

Na prática:

- se o dispositivo estiver offline, os comandos de periféricos **não devem ser aplicados**
- o app pode registrar erro de transporte em vez de confirmar a ação

---

## 7. Como interpretar o sensor de nível

O app usa quatro estados para a água:

- **Água presente**
- **Falta de água**
- **Sensor desabilitado**
- **Estado desconhecido**

Esses estados aparecem principalmente em:

- **Dashboard**
- **Dispositivos**
- **Controle**

### O que cada estado significa

| Estado mostrado | Significado no app |
|---|---|
| **Água presente** | `waterLevelState = ok` |
| **Falta de água** | `waterLevelState = low` |
| **Sensor desabilitado** | `waterLevelState = disabled` |
| **Estado desconhecido** | `waterLevelState = unknown` |

### Quando o app força “Sensor desabilitado”

Se `waterSensorEnabled` vier como `false`, o app força o estado para **Sensor desabilitado**.

Na aba **Controle**, isso gera um aviso específico:

- **Sensor de nível desabilitado**

---

## 8. Como usar os agendamentos

Abra a aba **Rotinas**. O título da tela é **Agendamentos**.

### O que você pode fazer hoje

- **Nova rotina**
- **Editar**
- **Pausar** ou **Ativar**
- **Excluir**

### Tipos de rotina disponíveis

No editor, o app mostra:

- **Ligar**
- **Desligar**
- **Dreno** (somente se o dreno estiver habilitado para o climatizador)

### Tipos de recorrência disponíveis

- **Único**
- **Diário**
- **Semanal**

### Campos do editor

- **Horário** no formato `HH:MM`
- **Data** no formato `AAAA-MM-DD` quando o tipo for único
- seleção de dias da semana quando o tipo for semanal
- estado **Ativo** ou **Pausado**

### Validações implementadas

O app valida:

- horário obrigatório e no formato `HH:MM`
- data obrigatória em `AAAA-MM-DD` para rotina única
- pelo menos um dia na rotina semanal
- tipo **Dreno** somente quando o climatizador permite dreno

### Como pausar ou ativar

Na lista, toque em:

- **Pausar** para desativar temporariamente
- **Ativar** para reativar

### Como editar

Toque em **Editar** no cartão da rotina.

### Como excluir

Toque em **Excluir** e confirme.

### Como a lista mostra a recorrência

Hoje a lista resume as rotinas assim:

- diário: `Diario as HH:MM`
- semanal: `Semanal (1, 2, 3) as HH:MM`
- único: `Unico em AAAA-MM-DD as HH:MM`

#### Observação importante

Na implementação atual, a lista semanal mostra os **números dos dias** em vez dos nomes. No editor, o mapeamento visual é:

- `0` = Dom
- `1` = Seg
- `2` = Ter
- `3` = Qua
- `4` = Qui
- `5` = Sex
- `6` = Sab

### Limitação importante sobre execução de agendamentos

O que está **confirmado no código atual**:

- o app cria, edita, pausa, ativa e exclui rotinas
- o app salva essas rotinas localmente
- o app tenta enviar/sincronizar rotinas para o transporte atual

O que **ainda não está completo no app**:

- o app não tem um mecanismo completo próprio para executar rotinas automaticamente como um scheduler final do usuário
- no modo simulação, o efeito automático está **parcial**
- hoje o simulador usa rotinas principalmente para alimentar o cenário e, de forma parcial, acionar **dreno**
- rotinas de **ligar/desligar** não têm execução automática completa implementada dentro do app

Em outras palavras:

- a tela de rotinas está funcional para **cadastro e persistência**
- a execução prática depende da **IHM** implementar e responder aos contratos, ou de evolução futura do projeto

---

## 9. Como configurar a conexão

Abra a tela **Conexão** do climatizador.

### Modo de comunicação

O seletor de modo traz estas opções:

- **Auto**
- **Cloud**
- **LAN**
- **AP**
- **Simulação**

### Como cada modo se comporta hoje

| Modo | O que o app faz hoje |
|---|---|
| **Auto** | Tenta cloud primeiro. Se o teste cloud falhar, a sessão cai para `local-lan` |
| **Cloud** | Usa MQTT sobre `ws` ou `wss` |
| **LAN** | Usa HTTP local com `host/IP + porta` |
| **AP** | Usa HTTP local, normalmente com a IHM em sua própria rede Wi-Fi |
| **Simulação** | Usa o simulador interno do app |

### Campos de cloud

Na seção **Cloud MQTT**, existem:

- **WS / WSS**
- **Broker MQTT**
- **Porta MQTT**
- **Usuário**
- **Senha**
- **deviceId**
- **Prefixo/topicos**

### Campos de Wi-Fi local

Na seção **Wi-Fi local**, existem:

- **Host/IP local**
- **Porta local**
- **SSID do AP da IHM**
- **Senha do AP**

### O que o app valida antes de salvar

Dependendo do modo selecionado, o app valida:

- broker MQTT
- porta MQTT
- prefixo de tópicos
- `deviceId`
- host/IP local
- porta local

Se houver erro, aparece o aviso **Campos a revisar** e o botão **Salvar configurações** fica desabilitado.

### Testes de conexão disponíveis

Na tela, existem os botões:

- **Testar cloud MQTT**
- **Testar local**

#### O que esses testes fazem hoje

- **Cloud**: tenta abrir uma conexão MQTT por WebSocket com o broker
- **Local**: tenta acessar o endpoint HTTP `/api/v1/ping`
- **Simulação**: responde com o transporte do simulador

### Importante sobre modo simulação

Se o climatizador estiver em **Simulação**, os testes seguem o simulador. Para validar broker ou host real:

1. troque o modo para **Cloud**, **LAN** ou **AP**
2. confira os campos
3. então rode o teste

### Importante sobre AP da IHM

O app atual:

- **guarda** SSID e senha do AP
- **não conecta o aparelho automaticamente** à rede da IHM

Você precisa fazer essa conexão manualmente nas configurações do sistema operacional.

### Importante sobre web

No uso web, o modo local depende de a IHM responder com **CORS** adequado. Sem isso, o navegador pode bloquear a comunicação local.

---

## 10. Como usar o modo simulação

O modo simulação serve para:

- conhecer o app sem hardware real
- demonstrar o fluxo para outra pessoa
- testar telas, estados e comandos
- validar o cadastro inicial

### Como ativar

Você pode usar a simulação de três formas:

- no primeiro uso do app, quando o cadastro ainda está vazio
- no assistente, escolhendo **Criar climatizador simulado**
- na tela **Conexão**, trocando o modo para **Simulação**

### O que a simulação faz hoje

O simulador interno:

- mantém o climatizador como dispositivo válido no cadastro
- atualiza estado periodicamente
- muda a frequência atual em direção à frequência alvo
- simula água presente e falta de água
- simula online e offline
- simula envio de comandos
- simula eventos
- simula falhas de confirmação de comando
- considera parcialmente rotinas, especialmente de dreno

### Limitações da simulação

- não existe hardware real por trás
- a leitura básica do onboarding também é simulada
- o comportamento não substitui um teste final com a IHM real
- a execução automática de rotinas ainda é parcial

---

## 11. Mensagens, estados e alertas

Estas são as mensagens e estados mais importantes da UI atual.

### Estado do dispositivo

| Estado | Onde aparece | O que significa |
|---|---|---|
| **Online** | Dispositivos, Dashboard | Houve confirmação recente do transporte |
| **Offline** | Dispositivos, Dashboard, Controle | Sem confirmação recente da IHM ou falha de transporte |

### Status do último comando

| Status | Significado |
|---|---|
| `idle` | Nenhum comando recente aguardando resposta |
| `sending` | Comando enviado, aguardando confirmação |
| `applied` | Comando confirmado/aplicado |
| `failed` | Houve falha no envio ou a IHM rejeitou o comando |

### Ready state

O app exibe estes estados:

- `ready`
- `starting`
- `running`
- `stopping`
- `draining`
- `fault`
- `offline`

### Status de transporte no diagnóstico

Na tela **Diagnóstico**, o campo **Transporte** pode mostrar:

- `idle`
- `connecting`
- `connected`
- `degraded`
- `error`

### Avisos e alertas visíveis no app

Mensagens implementadas na UI incluem:

- **Atenção de comunicação**
- **Dispositivo offline**
- **Comandos restritos**
- **Sensor de nível desabilitado**
- **Dreno indisponível**
- **Campos a revisar**
- **Teste concluído**
- **Teste com falha**
- **Último erro**

### Onde olhar quando algo falhar

- **Dashboard**: último erro conhecido e eventos recentes
- **Controle**: status do comando e último erro
- **Diagnóstico**: resumo de transporte, último sync, teste de conexão, capacidades, comandos e eventos
- **Dispositivos**: aviso global de comunicação

---

## 12. Boas práticas de uso

- Antes de ligar, desligar ou ajustar frequência, confira se o climatizador certo está marcado como **Ativo**.
- Se você estiver usando um dispositivo real recém-cadastrado, espere a primeira sincronização antes de confiar no estado mostrado.
- Para modo **Cloud**, use broker que aceite **WebSocket** (`ws`) ou **WebSocket seguro** (`wss`).
- Para modo **Local**, confira `host/IP`, `porta` e se o aparelho está na mesma rede da IHM.
- Para modo **AP**, conecte o celular/computador manualmente ao Wi-Fi da IHM antes de usar o modo local.
- Use a tela **Conexão** para testar cloud e local depois de qualquer alteração.
- Use a tela **Diagnóstico** para revisar capacidades antes de insistir em bomba, swing ou dreno.
- Ao criar rotinas semanais, confira os dias selecionados no editor. Na lista, eles aparecem como números.
- Se você quiser apenas conhecer o app, use o climatizador simulado já carregado no primeiro uso.

---

## 13. Solução de problemas

### O app não conecta

Verifique:

- se o climatizador está no modo correto em **Conexão**
- se o broker MQTT aceita `ws`/`wss`
- se `host/IP` e `porta` locais estão corretos
- se a IHM realmente implementa os endpoints ou tópicos esperados pelo app

Use:

- **Testar cloud MQTT**
- **Testar local**
- **Diagnóstico > Testar conexão**

### O climatizador não aparece

Na implementação atual:

- não existe descoberta automática completa na LAN
- a leitura do onboarding é simulada

Se o cadastro não estiver lá:

- volte para **Dispositivos**
- use **Adicionar**
- cadastre manualmente

### O comando não aplica

Possíveis causas:

- dispositivo offline
- broker conectou, mas a IHM não confirmou o comando
- host local responde mal ou não responde
- a IHM rejeitou o comando

No modo cloud:

- é normal o comando ficar em `sending` até chegar retorno do broker/IHM

Confira:

- **Controle > Feedback de comando**
- **Dashboard > Último erro conhecido**
- **Diagnóstico > Últimos comandos e Últimos eventos**

### A frequência não altera

Verifique:

- se o climatizador está **Online**
- se a frequência desejada está dentro de `fMinHz` e `fMaxHz`
- se o comando ficou preso em `sending`

Lembre:

- o app limita automaticamente o valor ao intervalo permitido
- no simulador, a frequência atual muda gradualmente

### O dreno não habilita

Se o botão aparecer como **Indisponível** ou a rotina de dreno não aparecer:

- o climatizador está com `drainAvailable = false`

Veja isso em:

- **Controle**
- **Dashboard**
- **Diagnóstico > Capacidades atuais**

### O sensor de água não aparece

Se você vê **Sensor desabilitado**, o motivo é:

- `waterSensorEnabled = false`

Se aparece **Estado desconhecido**, ainda não houve confirmação suficiente do transporte.

### O agendamento não funciona

Pelo estado atual do projeto:

- o cadastro de rotinas funciona
- a persistência local funciona
- o envio da rotina para o transporte existe
- a execução automática ainda depende da IHM ou de implementação futura

No simulador:

- a parte automática está parcial

### O modo local não funciona

Confira:

- `host/IP local`
- `porta local`
- se a IHM responde em `/api/v1/ping`
- se o aparelho está na mesma rede da IHM
- se, no web, a IHM libera **CORS**

### O modo cloud não funciona

Confira:

- broker MQTT correto
- porta correta
- uso de `ws` ou `wss`
- usuário e senha, se existirem
- `deviceId`
- `prefixo/topicos`

Também confira se a IHM publica e recebe nos tópicos esperados.

---

## 14. Glossário rápido

### IHM

Interface Homem-Máquina. Neste projeto, é o dispositivo baseado em ESP32 que faz a ponte entre o app e o sistema do climatizador.

### MQTT

Protocolo de mensagens usado no modo cloud. No app atual, ele é usado sobre **WebSocket** para funcionar bem também no navegador.

### Frequência

Valor em Hz usado no controle do inversor. No app, ela é limitada por `fMinHz` e `fMaxHz`.

### Dreno

Rotina para drenagem, quando o recurso estiver habilitado pela IHM.

### Sensor de nível

Sensor associado à condição de água. No app, pode aparecer como água presente, falta de água, sensor desabilitado ou estado desconhecido.

### AP da IHM

Rede Wi-Fi criada pela própria IHM para provisionamento ou fallback local.

---

## 15. Base desta documentação

### Arquivos inspecionados para produzir este manual

- `package.json`
- `app.json`
- `README.md`
- `app/_layout.tsx`
- `app/index.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/devices.tsx`
- `app/(tabs)/dashboard.tsx`
- `app/(tabs)/control.tsx`
- `app/(tabs)/schedules.tsx`
- `app/(tabs)/diagnostics.tsx`
- `app/device/add.tsx`
- `app/device/[id]/edit.tsx`
- `app/device/[id]/connection.tsx`
- `src/store/app-store.tsx`
- `src/features/onboarding/onboarding-wizard.tsx`
- `src/features/onboarding/device-discovery.ts`
- `src/features/devices/device-card.tsx`
- `src/features/devices/device-form.tsx`
- `src/features/connection/connection-form.tsx`
- `src/features/control/peripheral-tile.tsx`
- `src/features/schedules/schedule-editor-modal.tsx`
- `src/features/dashboard/event-feed.tsx`
- `src/components/frequency-slider.tsx`
- `src/components/empty-state.tsx`
- `src/components/inline-notice.tsx`
- `src/services/transports/transport-factory.ts`
- `src/services/transports/types.ts`
- `src/services/transports/simulation-transport.ts`
- `src/services/transports/simulation-engine.ts`
- `src/services/transports/local-http-transport.ts`
- `src/services/transports/mqtt-websocket-transport.ts`
- `src/services/device-service.ts`
- `src/services/storage/app-storage.ts`
- `src/services/storage/secure-storage.ts`
- `src/services/storage/storage-keys.ts`
- `src/mocks/defaults.ts`
- `src/types/models.ts`
- `src/protocol/deviceState.ts`
- `src/protocol/deviceCapabilities.ts`
- `src/protocol/scheduleContract.ts`
- `src/protocol/localApiContract.ts`
- `src/utils/device.ts`
- `src/utils/validation.ts`

### Partes 100% confirmadas pelo código

- estrutura de navegação e nomes das telas
- existência das abas **Dispositivos**, **Dashboard**, **Controle**, **Rotinas** e **Diagnóstico**
- existência das telas auxiliares **Adicionar climatizador**, **Editar climatizador** e **Conexão**
- cadastro de múltiplos climatizadores
- seleção de climatizador ativo
- favoritar, editar e remover
- criação automática de um climatizador simulado no primeiro uso
- controle de liga/desliga
- ajuste de frequência com slider e campo numérico
- clamp da frequência por `fMinHz` e `fMaxHz`
- bloqueio por capacidades de bomba, swing e dreno
- tratamento dos estados do sensor de água
- persistência local de dispositivos, agendamentos e preferências
- separação de segredos com `expo-secure-store` quando disponível
- conexão cloud por MQTT WebSocket
- conexão local por HTTP
- testes de conexão cloud e local
- modo simulação com atualização automática de estado

### O que ainda depende de implementação futura ou está parcial

- leitura real de dados básicos da IHM no assistente de cadastro
- troca automática de rede Wi-Fi pelo app
- descoberta automática real na rede local
- execução automática completa dos agendamentos pelo próprio app
- confirmação completa de rotinas no fluxo cloud
- comportamento final de produção dependente do firmware da IHM responder aos contratos esperados
- diagnóstico cloud mais rico vindo diretamente da IHM

