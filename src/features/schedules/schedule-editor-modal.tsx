import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/src/components/action-button';
import { Field } from '@/src/components/field';
import { InlineNotice } from '@/src/components/inline-notice';
import { SegmentedControl } from '@/src/components/segmented-control';
import { SurfaceCard } from '@/src/components/surface-card';
import { colors, radii, spacing, typography } from '@/src/theme';
import type { Schedule, ScheduleRecurrence, ScheduleType } from '@/src/types';
import { validateSchedule } from '@/src/utils/validation';

const weekdayLabels = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sab', value: 6 },
];

interface ScheduleEditorModalProps {
  visible: boolean;
  allowDrain: boolean;
  initialValue: Schedule;
  onClose: () => void;
  onSave: (schedule: Schedule) => void;
}

export function ScheduleEditorModal({
  visible,
  allowDrain,
  initialValue,
  onClose,
  onSave,
}: ScheduleEditorModalProps) {
  const [draft, setDraft] = useState(initialValue);
  const errors = useMemo(() => validateSchedule(draft, allowDrain), [draft, allowDrain]);

  useEffect(() => {
    if (visible) {
      setDraft(initialValue);
    }
  }, [initialValue, visible]);

  const typeOptions = [
    { label: 'Ligar', value: 'power-on' as ScheduleType },
    { label: 'Desligar', value: 'power-off' as ScheduleType },
    ...(allowDrain ? [{ label: 'Dreno', value: 'drain-cycle' as ScheduleType }] : []),
  ];

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <SurfaceCard title="Agendamento" subtitle="Crie rotinas locais prontas para futura sincronizacao com a IHM.">
              <SegmentedControl
                value={draft.type}
                options={typeOptions}
                onChange={(type) => setDraft({ ...draft, type })}
              />

              <SegmentedControl
                value={draft.recurrence}
                options={[
                  { label: 'Unico', value: 'one-shot' as ScheduleRecurrence },
                  { label: 'Diario', value: 'daily' as ScheduleRecurrence },
                  { label: 'Semanal', value: 'weekly' as ScheduleRecurrence },
                ]}
                onChange={(recurrence) => setDraft({ ...draft, recurrence })}
              />

              <Field
                label="Horario"
                value={draft.time}
                onChangeText={(time) => setDraft({ ...draft, time })}
                placeholder="HH:MM"
                helper="Use horario de 24 horas, por exemplo 07:30."
              />

              {draft.recurrence === 'one-shot' ? (
                <Field
                  label="Data"
                  value={draft.oneShotDate ?? ''}
                  onChangeText={(oneShotDate) => setDraft({ ...draft, oneShotDate })}
                  placeholder="AAAA-MM-DD"
                />
              ) : null}

              {draft.recurrence === 'weekly' ? (
                <View style={styles.days}>
                  {weekdayLabels.map((day) => {
                    const selected = draft.daysOfWeek.includes(day.value);
                    return (
                      <Pressable
                        key={day.value}
                        onPress={() =>
                          setDraft({
                            ...draft,
                            daysOfWeek: selected
                              ? draft.daysOfWeek.filter((value) => value !== day.value)
                              : [...draft.daysOfWeek, day.value].sort(),
                          })
                        }
                        style={[styles.day, selected ? styles.daySelected : null]}>
                        <Text style={[styles.dayLabel, selected ? styles.dayLabelSelected : null]}>
                          {day.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <SegmentedControl
                value={draft.enabled ? 'enabled' : 'disabled'}
                options={[
                  { label: 'Ativo', value: 'enabled' },
                  { label: 'Pausado', value: 'disabled' },
                ]}
                onChange={(value) => setDraft({ ...draft, enabled: value === 'enabled' })}
              />

              {errors.length > 0 ? (
                <InlineNotice title="Ajustes necessarios" message={errors.join(' ')} tone="warning" />
              ) : null}

              <View style={styles.actions}>
                <ActionButton label="Cancelar" onPress={onClose} variant="ghost" />
                <ActionButton
                  label="Salvar rotina"
                  onPress={() => {
                    if (errors.length === 0) {
                      onSave({
                        ...draft,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  }}
                />
              </View>
            </SurfaceCard>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modal: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    maxHeight: '92%',
  },
  modalContent: {
    gap: spacing.md,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  day: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  daySelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
  },
  dayLabelSelected: {
    color: '#1A2D12',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
