export type MqttProtocol = 'ws' | 'wss';

export const MQTT_TOPIC_SEGMENTS = {
  status: 'status',
  state: 'state',
  capabilities: 'capabilities',
  commands: 'commands',
  events: 'events',
  errors: 'errors',
  schedules: 'schedules',
} as const;

export type MqttTopicKey = keyof typeof MQTT_TOPIC_SEGMENTS;

export interface MqttTopicContract {
  base: string;
  status: string;
  state: string;
  capabilities: string;
  commands: string;
  events: string;
  errors: string;
  schedules: string;
}

function sanitizeTopicSegment(value: string) {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function buildDeviceTopicBase(topicPrefix: string, deviceId: string) {
  const prefix = sanitizeTopicSegment(topicPrefix);
  const normalizedDeviceId = sanitizeTopicSegment(deviceId);
  return `${prefix}/${normalizedDeviceId}`;
}

export function buildMqttTopics(topicPrefix: string, deviceId: string): MqttTopicContract {
  const base = buildDeviceTopicBase(topicPrefix, deviceId);

  return {
    base,
    status: `${base}/${MQTT_TOPIC_SEGMENTS.status}`,
    state: `${base}/${MQTT_TOPIC_SEGMENTS.state}`,
    capabilities: `${base}/${MQTT_TOPIC_SEGMENTS.capabilities}`,
    commands: `${base}/${MQTT_TOPIC_SEGMENTS.commands}`,
    events: `${base}/${MQTT_TOPIC_SEGMENTS.events}`,
    errors: `${base}/${MQTT_TOPIC_SEGMENTS.errors}`,
    schedules: `${base}/${MQTT_TOPIC_SEGMENTS.schedules}`,
  };
}

export function getStatusTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).status;
}

export function getStateTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).state;
}

export function getCapabilitiesTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).capabilities;
}

export function getCommandsTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).commands;
}

export function getEventsTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).events;
}

export function getErrorsTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).errors;
}

export function getSchedulesTopic(deviceId: string, topicPrefix: string) {
  return buildMqttTopics(topicPrefix, deviceId).schedules;
}

export function detectMqttTopicKey(topics: MqttTopicContract, topic: string): MqttTopicKey | undefined {
  const pairs = Object.entries(topics).filter(([key]) => key !== 'base') as [
    MqttTopicKey,
    string,
  ][];

  return pairs.find(([, expectedTopic]) => expectedTopic === topic)?.[0];
}
