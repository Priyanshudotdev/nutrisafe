import React, { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors as lightColors } from "../../theme/tokens";
import { darkColors } from "../../theme/darkTokens";
import { themeStore } from "../../services/themeStore";

function subscribe(cb: () => void) {
  return themeStore.subscribe(cb);
}
function getSnapshot() {
  return themeStore.getMode();
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const systemScheme = useColorScheme();
  const isDark = themeStore.resolve(systemScheme) === "dark";
  const colors = isDark ? { ...lightColors, ...darkColors } : lightColors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          elevation: 0,
          shadowColor: "transparent",
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: lightColors.primaryDark,
        tabBarInactiveTintColor: colors.gray4,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "camera" : "camera-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
