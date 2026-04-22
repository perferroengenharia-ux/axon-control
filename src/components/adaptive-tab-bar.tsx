import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme';

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  devices: 'apps-outline',
  dashboard: 'speedometer-outline',
  control: 'options-outline',
  schedules: 'calendar-outline',
  diagnostics: 'pulse-outline',
};

export function AdaptiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={[styles.shell, Platform.OS === 'web' ? styles.shellWeb : null]}>
      <View style={[styles.bar, Platform.OS === 'web' ? styles.barWeb : null]}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const iconName = iconMap[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.item, focused ? styles.itemActive : null]}>
              {iconName ? (
                <Ionicons
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name={iconName}
                  size={20}
                />
              ) : null}
              <Text style={[styles.label, focused ? styles.labelActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  shellWeb: {
    paddingTop: spacing.sm,
    paddingBottom: 0,
  },
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    maxWidth: 1180,
    alignSelf: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  barWeb: {
    width: '100%',
  },
  item: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  itemActive: {
    backgroundColor: colors.brand,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
