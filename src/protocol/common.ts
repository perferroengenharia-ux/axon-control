export const PROTOCOL_SCHEMA_VERSION = 'axon.ihm.v1' as const;

export type ProtocolSchemaVersion = typeof PROTOCOL_SCHEMA_VERSION;

export const PROTOCOL_SOURCES = ['app', 'ihm', 'simulation'] as const;

export type ProtocolSource = (typeof PROTOCOL_SOURCES)[number];

export interface ProtocolMetadata {
  schema: ProtocolSchemaVersion;
  deviceId: string;
  timestamp: string;
  source: ProtocolSource;
}

export function createProtocolMetadata(
  deviceId: string,
  timestamp: string,
  source: ProtocolSource,
): ProtocolMetadata {
  return {
    schema: PROTOCOL_SCHEMA_VERSION,
    deviceId,
    timestamp,
    source,
  };
}
