import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { DeviceForm, type DeviceFormValue } from '@/src/features/devices/device-form';
import { useAppStore } from '@/src/store';

export default function EditDeviceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { state, upsertDevice } = useAppStore();

  const device = useMemo(
    () => state.devices.find((entry) => entry.id === params.id) ?? null,
    [params.id, state.devices],
  );

  const [form, setForm] = useState<DeviceFormValue>({
    name: device?.name ?? '',
    location: device?.location ?? '',
    notes: device?.notes ?? '',
  });

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name,
        location: device.location,
        notes: device.notes ?? '',
      });
    }
  }, [device]);

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader eyebrow="Edicao" title="Carregando climatizador" subtitle="Estamos restaurando o cadastro antes de abrir a edicao." />
        <LoadingState description="Buscando o climatizador e suas configuracoes locais." />
      </Screen>
    );
  }

  if (!device) {
    return (
      <Screen>
        <PageHeader eyebrow="Edicao" title="Climatizador nao encontrado" subtitle="O cadastro pode ter sido removido ou o link perdeu a referencia." />
        <EmptyState
          title="Nada para editar"
          description="Volte para a lista de climatizadores e escolha um cadastro valido."
          action={<ActionButton label="Ir para dispositivos" onPress={() => router.replace('/devices')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Edicao local"
        title={`Editar ${device.name}`}
        subtitle="Ajuste o nome amigavel, local e observacoes sem mexer nos contratos de comunicacao."
        actions={<ActionButton label="Conexao" onPress={() => router.push(`/device/${device.id}/connection`)} variant="ghost" />}
      />
      <InlineNotice
        title="Edicao segura"
        message="Credenciais sensiveis continuam separadas do armazenamento comum quando a plataforma permitir."
      />
      <DeviceForm
        deviceId={device.deviceId}
        submitLabel="Salvar alteracoes"
        value={form}
        onChange={setForm}
        onSubmit={() => {
          upsertDevice({
            device: {
              ...device,
              name: form.name,
              location: form.location,
              notes: form.notes,
            },
          });
          router.back();
        }}
      />
    </Screen>
  );
}
