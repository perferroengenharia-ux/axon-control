import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/src/components/action-button';
import { Field } from '@/src/components/field';
import { SurfaceCard } from '@/src/components/surface-card';
import { spacing } from '@/src/theme';

export interface DeviceFormValue {
  name: string;
  location: string;
  notes: string;
}

interface DeviceFormProps {
  value: DeviceFormValue;
  deviceId: string;
  onChange: (next: DeviceFormValue) => void;
  onSubmit: () => void;
  submitLabel: string;
}

export function DeviceForm({
  value,
  deviceId,
  onChange,
  onSubmit,
  submitLabel,
}: DeviceFormProps) {
  return (
    <SurfaceCard
      title="Identificacao amigavel"
      subtitle="Edite as informacoes exibidas no cadastro local do app.">
      <Field
        label="Nome do climatizador"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        placeholder="Ex.: Climatizador do showroom"
      />
      <Field
        label="Local / ambiente"
        value={value.location}
        onChangeText={(location) => onChange({ ...value, location })}
        placeholder="Ex.: Recepcao"
      />
      <Field label="deviceId" value={deviceId} editable={false} />
      <Field
        label="Observacoes"
        value={value.notes}
        onChangeText={(notes) => onChange({ ...value, notes })}
        multiline
        placeholder="Detalhes operacionais, manutencao ou observacoes gerais."
      />

      <View style={styles.actions}>
        <ActionButton label={submitLabel} onPress={onSubmit} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: spacing.sm,
  },
});
