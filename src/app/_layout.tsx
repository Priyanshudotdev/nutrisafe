import type { JSX } from "react";
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { authStore } from "../services/authStore";
import { themeStore } from "../services/themeStore";
import { notificationStore } from "../services/notificationStore";
import { hydrateSessionData } from "../services/sessionSync";
import { needsOnboarding } from "../services/onboardingService";
import { colors } from "../theme/tokens";
import { darkColors } from "../theme/darkTokens";
import "../global.css";

function subscribeAuth(cb: () => void) {
  return authStore.subscribe(cb);
}
function getAuthSnapshot() {
  return authStore.isAuthenticated();
}
function getProfileSnapshot() {
  return authStore.getProfile();
}

function subscribeTheme(cb: () => void) {
  return themeStore.subscribe(cb);
}
function getThemeSnapshot() {
  return themeStore.getMode();
}

function AuthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);
  const profile = useSyncExternalStore(subscribeAuth, getProfileSnapshot, getProfileSnapshot);
  const systemScheme = useColorScheme();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([authStore.init(), themeStore.init(), notificationStore.init()])
      .then(() => hydrateSessionData())
      .finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (isAuthenticated) {
      hydrateSessionData();
    }
  }, [isAuthenticated, initialized]);

  useEffect(() => {
    if (!initialized) return;

    const root = segments[0];
    const inTabs = root === "(tabs)";
    const onAuthPage = root === "login" || root === "signup";
    const onOnboarding = root === "onboarding";

    if (!isAuthenticated) {
      // Unauthed: any protected surface (tabs, onboarding, or bare root) goes to login.
      // Idempotent: only replace when not already on an auth page.
      if ((inTabs || onOnboarding || !root) && !onAuthPage) {
        router.replace("/login");
      }
      return;
    }

    // Authenticated — wait for profile hydration before deciding.
    // profile===null means unknown (pending), not complete.
    if (profile === null) {
      if (!onOnboarding) {
        router.replace("/onboarding");
      }
      return;
    }

    const onboardingPending = needsOnboarding(profile);

    // Authenticated
    if (onboardingPending) {
      if (!onOnboarding) {
        router.replace("/onboarding");
      }
      return;
    }

    // Onboarding done
    if (onAuthPage || onOnboarding) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, initialized, segments, router, profile]);

  if (!initialized) {
    const isDark = themeStore.resolve(systemScheme) === "dark";
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? darkColors.background : colors.background,
        }}
      >
        <ActivityIndicator color={colors.primaryText} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout(): JSX.Element {
  useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
  const systemScheme = useColorScheme();
  const effectiveScheme = themeStore.resolve(systemScheme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="onboarding" />
        </Stack>
      </AuthGate>
      <StatusBar style={effectiveScheme === "dark" ? "light" : "dark"} />
    </GestureHandlerRootView>
  );
}
