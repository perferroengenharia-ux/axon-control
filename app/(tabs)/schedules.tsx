import { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ActionButton } from '@/src/components/action-button';
import { EmptyState } from '@/src/components/empty-state';
import { InlineNotice } from '@/src/components/inline-notice';
import { LoadingState } from '@/src/components/loading-state';
import { PageHeader } from '@/src/components/page-header';
import { Screen } from '@/src/components/screen';
import { StatusBadge } from '@/src/components/status-badge';
import { SurfaceCard } from '@/src/components/surface-card';
import { ScheduleEditorModal } from '@/src/features/schedules/schedule-editor-modal';
import { useAppStore, useDeviceSchedules } from '@/src/store';
import { colors, spacing, typography } from '@/src/theme';
import type { Schedule } from '@/src/types';
import { createId } from '@/src/utils/id';

function formatRecurrence(schedule: Schedule) {
  if (schedule.recurrence === 'daily') {
    return `Diario as ${schedule.time}`;
  }

  if (schedule.recurrence === 'weekly') {
    return `Semanal (${schedule.daysOfWeek.join(', ')}) as ${schedule.time}`;
  }

  return `Unico em ${schedule.oneShotDate ?? 'sem data'} as ${schedule.time}`;
}

function createDraftSchedule(deviceId: string): Schedule {
  const now = new Date().toISOString();

  return {
    id: createId('sch'),
    deviceId,
    type: 'power-on',
    recurrence: 'daily',
    enabled: true,
    time: '07:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    oneShotDate: null,
    createdAt: now,
    updatedAt: now,
  };
}

export default function SchedulesScreen() {
  const router = useRouter();
  const { activeDevice, activeSnapshot, upsertSchedule, deleteSchedule, state } = useAppStore();
  const schedules = useDeviceSchedules(activeDevice?.id);
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState<Schedule | null>(null);

  const allowDrain = activeSnapshot?.capabilities.drainAvailable ?? false;
  const orderedSchedules = useMemo(
    () => [...schedules].sort((a, b) => a.time.localeCompare(b.time)),
    [schedules],
  );

  const requestDelete = (scheduleId: string) => {
    const confirmDelete = () => void deleteSchedule(scheduleId);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Excluir esta rotina local?')) {
        confirmDelete();
      }
      return;
    }

    Alert.alert('Excluir rotina', 'Esta rotina sera removida do cadastro local.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  if (!state.hydrated) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Automacoes locais"
          title="Agendamentos"
          subtitle="Carregando dispositivos e rotinas persistidas localmente."
        />
        <LoadingState description="Preparando os agendamentos do climatizador ativo." />
      </Screen>
    );
  }

  if (!activeDevice || !activeSnapshot) {
    return (
      <Screen>
        <PageHeader
          eyebrow="Automacoes locais"
          title="Agendamentos"
          subtitle="Selecione um climatizador ativo para criar rotinas locais prontas para futura sincronizacao com a IHM."
        />
        <EmptyState
          title="Nenhum climatizador ativo"
          description="Escolha uma IHM na aba de dispositivos para destravar o cadastro de rotinas."
          action={<ActionButton label="Abrir dispositivos" onPress={() => router.push('/devices')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Rotinas locais"
        title={`Agendamentos de ${activeDevice.name}`}
        subtitle="Os agendamentos ficam persistidos localmente e a estrutura ja foi preparada para sincronizacao futura com a IHM."
        actions={
          <ActionButton
            label="Nova rotina"
            onPress={() => {
              setDraft(createDraftSchedule(activeDevice.id));
              setEditorVisible(true);
            }}
          />
        }
      />

      {!allowDrain ? (
        <InlineNotice
          title="Dreno indisponivel"
          message="O firmware atual nao habilitou dreno para este climatizador, entao a rotina de dreno fica oculta no editor."
          tone="warning"
        />
      ) : null}

      {orderedSchedules.length === 0 ? (
        <EmptyState
          title="Nenhuma rotina criada"
          description="Crie rotinas de ligar, desligar ou dreno. A persistencia local ja esta pronta para uma futura sincronizacao com a IHM."
          action={
            <ActionButton
              label="Criar primeira rotina"
              onPress={() => {
                setDraft(createDraftSchedule(activeDevice.id));
                setEditorVisible(true);
              }}
            />
          }
        />
      ) : (
        <View style={styles.list}>
          {orderedSchedules.map((schedule) => (
            <SurfaceCard
              key={schedule.id}
              title={schedule.type}
              subtitle={formatRecurrence(schedule)}
              accent={
                <StatusBadge
                  label={schedule.enabled ? 'Ativo' : 'Pausado'}
                  tone={schedule.enabled ? 'success' : 'neutral'}
                />
              }>
              <Text style={styles.scheduleMeta}>Atualizado em {schedule.updatedAt.slice(0, 16).replace('T', ' ')}</Text>
              <View style={styles.actions}>
                <ActionButton
                  label={schedule.enabled ? 'Pausar' : 'Ativar'}
                  onPress={() =>
                    upsertSchedule({
                      ...schedule,
                      enabled: !schedule.enabled,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  variant="ghost"
                />
                <ActionButton
                  label="Editar"
                  onPress={() => {
                    setDraft(schedule);
                    setEditorVisible(true);
                  }}
                  variant="ghost"
                />
                <ActionButton label="Excluir" onPress={() => requestDelete(schedule.id)} variant="danger" />
              </View>
            </SurfaceCard>
          ))}
        </View>
      )}

      {draft ? (
        <ScheduleEditorModal
          allowDrain={allowDrain}
          initialValue={draft}
          visible={editorVisible}
          onClose={() => setEditorVisible(false)}
          onSave={(schedule) => {
            void upsertSchedule(schedule);
            setEditorVisible(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  scheduleMeta: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
