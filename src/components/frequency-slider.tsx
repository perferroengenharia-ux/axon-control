import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/theme';

interface FrequencySliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function FrequencySlider({ value, min, max, onChange }: FrequencySliderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>{min} Hz</Text>
        <Text style={styles.value}>{value} Hz</Text>
        <Text style={styles.rangeLabel}>{max} Hz</Text>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.surfaceStrong}
        thumbTintColor={colors.accent}
        onValueChange={(nextValue) => onChange(Math.round(nextValue))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: typography.label,
    color: colors.textMuted,
  },
  value: {
    fontSize: typography.section,
    fontWeight: '800',
    color: colors.text,
  },
});
