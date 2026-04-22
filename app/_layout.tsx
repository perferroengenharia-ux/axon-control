import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppStoreProvider } from '@/src/store';
import { appTheme, colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStoreProvider>
        <ThemeProvider value={appTheme}>
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '800', color: colors.text },
              contentStyle: { backgroundColor: colors.surface },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="device/add" options={{ title: 'Adicionar climatizador' }} />
            <Stack.Screen name="device/[id]/edit" options={{ title: 'Editar climatizador' }} />
            <Stack.Screen name="device/[id]/connection" options={{ title: 'Conexao' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
  );
}
