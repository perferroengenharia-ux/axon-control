import { DefaultTheme, type Theme } from '@react-navigation/native';

import { colors } from './tokens';

export const appTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.surface,
    card: colors.card,
    border: colors.border,
    notification: colors.accent,
    primary: colors.brand,
    text: colors.text,
  },
};

export * from './tokens';
