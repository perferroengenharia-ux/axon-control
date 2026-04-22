import type { LocalConfig, MQTTConfig, OnboardingDraft, Schedule } from '@/src/types';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function validateMqttConfig(config: MQTTConfig) {
  const errors: string[] = [];

  if (!config.brokerUrl.trim()) {
    errors.push('Informe o broker MQTT.');
  } else if (config.brokerUrl.includes(' ')) {
    errors.push('O broker MQTT nao pode conter espacos.');
  }

  if (!config.topicPrefix.trim()) {
    errors.push('Informe o prefixo de topicos MQTT.');
  }

  if (!config.deviceId.trim()) {
    errors.push('Informe o deviceId.');
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    errors.push('Informe uma porta MQTT valida.');
  }

  return errors;
}

export function validateLocalConfig(config: LocalConfig) {
  const errors: string[] = [];

  if (!config.host.trim()) {
    errors.push('Informe o host ou IP local.');
  } else if (config.host.includes(' ')) {
    errors.push('O host local nao pode conter espacos.');
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    errors.push('Informe uma porta local valida.');
  }

  return errors;
}

export function validateOnboardingStepThree(draft: OnboardingDraft) {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push('Defina um nome amigavel para o climatizador.');
  }

  if (!draft.location.trim()) {
    errors.push('Informe o local ou ambiente.');
  }

  return errors;
}

export function validateOnboardingProvisioning(draft: OnboardingDraft) {
  if (draft.method === 'simulation') {
    return [];
  }

  const errors = validateLocalConfig({
    host: draft.host,
    port: draft.localPort,
  });

  const shouldValidateCloud =
    Boolean(draft.brokerUrl.trim()) ||
    Boolean(draft.topicPrefix.trim()) ||
    Boolean(draft.mqttUsername.trim()) ||
    Boolean(draft.mqttPassword.trim()) ||
    Boolean(draft.deviceId.trim());

  if (shouldValidateCloud) {
    errors.push(
      ...validateMqttConfig({
        brokerUrl: draft.brokerUrl,
        port: draft.brokerPort,
        protocol: draft.protocol,
        username: draft.mqttUsername,
        password: draft.mqttPassword,
        topicPrefix: draft.topicPrefix,
        deviceId: draft.deviceId || 'pending-device-id',
      }).filter((error) => error !== 'Informe o deviceId.'),
    );
  }

  return errors;
}

export function validateSchedule(schedule: Schedule, allowDrain: boolean) {
  const errors: string[] = [];

  if (!schedule.time.trim()) {
    errors.push('Informe um horario no formato HH:MM.');
  } else if (!timeRegex.test(schedule.time.trim())) {
    errors.push('Use horario no formato HH:MM, por exemplo 07:30.');
  }

  if (schedule.type === 'drain-cycle' && !allowDrain) {
    errors.push('O dreno nao esta habilitado para este climatizador.');
  }

  if (schedule.recurrence === 'weekly' && schedule.daysOfWeek.length === 0) {
    errors.push('Escolha ao menos um dia da semana.');
  }

  if (schedule.recurrence === 'one-shot' && !schedule.oneShotDate) {
    errors.push('Escolha a data para o agendamento unico.');
  } else if (schedule.recurrence === 'one-shot' && schedule.oneShotDate && !dateRegex.test(schedule.oneShotDate)) {
    errors.push('Use a data no formato AAAA-MM-DD.');
  }

  return errors;
}
