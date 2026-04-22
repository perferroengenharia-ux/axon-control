import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/src/theme';

interface InfoPairProps {
  label: string;
  value: string;
}

export function InfoPair({ label, value }: InfoPairProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 2,
  },
  label: {
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
});
