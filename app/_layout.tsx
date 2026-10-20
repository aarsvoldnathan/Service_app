import { Inter_300Light, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';
import { useFonts } from 'expo-font';
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
import { font, useTheme } from '../src/theme';

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
          headerTitleStyle: { fontFamily: font.heading, fontSize: 21 },
          headerBackTitleStyle: { fontFamily: font.regular },
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
  // Rugged condensed headings (Oswald) and thin modern text (Inter). If loading fails the app
  // still opens with the phone's own font.
  const [loaded, error] = useFonts({ Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold, Inter_300Light, Inter_400Regular, Inter_500Medium });
  if (!loaded && !error) return <Loading />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
