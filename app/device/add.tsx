import { useRouter } from 'expo-router';

import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { OnboardingWizard } from '@/src/features/onboarding/onboarding-wizard';
import { useAppStore } from '@/src/store';

export default function AddDeviceScreen() {
  const router = useRouter();
  const { upsertDevice, state } = useAppStore();

  return (
    <Screen>
      <PageHeader
        eyebrow="Provisionamento"
        title="Adicionar climatizador"
        subtitle="Assistente guiado para cadastrar uma nova IHM por AP, rede local, host manual ou simulacao."
      />
      {!state.hydrated ? (
        <LoadingState description="Carregando o cadastro local antes de iniciar um novo onboarding." />
      ) : (
        <OnboardingWizard
          onComplete={(device) => {
            upsertDevice({ device, setActive: true });
            router.replace('/devices');
          }}
        />
      )}
    </Screen>
  );
}
