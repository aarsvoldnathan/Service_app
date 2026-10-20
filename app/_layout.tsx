import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth';
import { CloudProvider } from '../src/cloud';
import { ExcelProvider } from '../src/sheets/ExcelLink';
import { AuthScreen } from '../src/screens/AuthScreen';
import { Onboarding } from '../src/screens/Onboarding';
import { StoreProvider, userStorageKey, useStore } from '../src/store';
import { useTheme } from '../src/theme';

function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.accent} size="large" />
    </View>
  );
}

function ThemedStack() {
  const { c, isDark } = useTheme();
  const { ready, fleets } = useStore();
  if (!ready) return <Loading />;
  if (!fleets.length) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Onboarding />
      </>
    );
  }
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="find" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

/** Signed out: log-in screen. Signed in: that account's data, synced online. */
function Gate() {
  const { loading, userId } = useAuth();
  if (loading) return <Loading />;
  if (!userId) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }
  return (
    <StoreProvider key={userId} storageKey={userStorageKey(userId)}>
      <CloudProvider>
        <ExcelProvider>
          <ThemedStack />
        </ExcelProvider>
      </CloudProvider>
    </StoreProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
