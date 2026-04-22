import { Tabs } from 'expo-router';

import { AdaptiveTabBar } from '@/src/components/adaptive-tab-bar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <AdaptiveTabBar {...props} />}>
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Dispositivos',
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen name="control" options={{ title: 'Controle' }} />
      <Tabs.Screen name="schedules" options={{ title: 'Rotinas' }} />
      <Tabs.Screen name="diagnostics" options={{ title: 'Diagnostico' }} />
    </Tabs>
  );
}
