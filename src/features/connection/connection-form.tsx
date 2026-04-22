import { StyleSheet, View } from 'react-native';

import { Field } from '@/src/components/field';
import { SegmentedControl } from '@/src/components/segmented-control';
import { SurfaceCard } from '@/src/components/surface-card';
import { spacing } from '@/src/theme';
import type { ClimateDevice, PreferredConnectionMode } from '@/src/types';

interface ConnectionFormProps {
  value: ClimateDevice;
  onChange: (next: ClimateDevice) => void;
}

export function ConnectionForm({ value, onChange }: ConnectionFormProps) {
  return (
    <View style={styles.wrapper}>
      <SurfaceCard
        title="Modo de comunicacao"
        subtitle="Cloud usa MQTT sobre WebSocket. Local usa HTTP com polling leve para manter compatibilidade com Android, iOS e web.">
        <SegmentedControl
          value={value.preferredConnectionMode}
          options={[
            { label: 'Auto', value: 'auto' as PreferredConnectionMode },
            { label: 'Cloud', value: 'cloud' as PreferredConnectionMode },
            { label: 'LAN', value: 'local-lan' as PreferredConnectionMode },
            { label: 'AP', value: 'local-ap' as PreferredConnectionMode },
            { label: 'Simulacao', value: 'simulation' as PreferredConnectionMode },
          ]}
          onChange={(preferredConnectionMode) =>
            onChange({
              ...value,
              preferredConnectionMode,
              isSimulation: preferredConnectionMode === 'simulation',
            })
          }
        />
      </SurfaceCard>

      <SurfaceCard title="Cloud MQTT" subtitle="Use WS ou WSS para maximizar a compatibilidade da aplicacao com o web.">
        <SegmentedControl
          value={value.mqttConfig.protocol}
          options={[
            { label: 'WS', value: 'ws' },
            { label: 'WSS', value: 'wss' },
          ]}
          onChange={(protocol) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                protocol,
              },
            })
          }
        />
        <Field
          label="Broker MQTT"
          value={value.mqttConfig.brokerUrl}
          onChangeText={(brokerUrl) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                brokerUrl,
              },
            })
          }
          placeholder="broker.example.com/mqtt"
        />
        <Field
          label="Porta MQTT"
          value={String(value.mqttConfig.port)}
          onChangeText={(raw) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                port: Number(raw) || 0,
              },
            })
          }
          keyboardType="number-pad"
        />
        <Field
          label="Usuario"
          value={value.mqttConfig.username ?? ''}
          onChangeText={(username) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                username,
              },
            })
          }
        />
        <Field
          label="Senha"
          value={value.mqttConfig.password ?? ''}
          onChangeText={(password) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                password,
              },
            })
          }
          secureTextEntry
        />
        <Field
          label="deviceId"
          value={value.mqttConfig.deviceId}
          onChangeText={(deviceId) =>
            onChange({
              ...value,
              deviceId,
              mqttConfig: {
                ...value.mqttConfig,
                deviceId,
              },
            })
          }
        />
        <Field
          label="Prefixo/topicos"
          value={value.mqttConfig.topicPrefix}
          onChangeText={(topicPrefix) =>
            onChange({
              ...value,
              mqttConfig: {
                ...value.mqttConfig,
                topicPrefix,
              },
            })
          }
        />
      </SurfaceCard>

      <SurfaceCard title="Wi-Fi local" subtitle="O fallback local usa host/IP manual e endpoints HTTP editaveis.">
        <Field
          label="Host/IP local"
          value={value.localConfig.host}
          onChangeText={(host) =>
            onChange({
              ...value,
              localConfig: {
                ...value.localConfig,
                host,
              },
            })
          }
          placeholder="192.168.1.88"
        />
        <Field
          label="Porta local"
          value={String(value.localConfig.port)}
          onChangeText={(raw) =>
            onChange({
              ...value,
              localConfig: {
                ...value.localConfig,
                port: Number(raw) || 0,
              },
            })
          }
          keyboardType="number-pad"
        />
        <Field
          label="SSID do AP da IHM"
          value={value.localConfig.accessPointSsid ?? ''}
          onChangeText={(accessPointSsid) =>
            onChange({
              ...value,
              localConfig: {
                ...value.localConfig,
                accessPointSsid,
              },
            })
          }
        />
        <Field
          label="Senha do AP"
          value={value.localConfig.accessPointPassword ?? ''}
          onChangeText={(accessPointPassword) =>
            onChange({
              ...value,
              localConfig: {
                ...value.localConfig,
                accessPointPassword,
              },
            })
          }
          secureTextEntry
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
});
