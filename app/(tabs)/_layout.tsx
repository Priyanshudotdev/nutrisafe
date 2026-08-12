import { Tabs } from "expo-router";
import React from "react";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { nutriSafeColors } from "@/components/NutriSafeTheme";
import { View, Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: nutriSafeColors.primary,
        tabBarInactiveTintColor: nutriSafeColors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: nutriSafeColors.outlineVariant,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 84 : 68,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: focused ? nutriSafeColors.primary : nutriSafeColors.primaryContainer,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Platform.OS === "ios" ? 4 : 8,
                shadowColor: nutriSafeColors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Ionicons
                name="camera"
                size={24}
                color={focused ? "#ffffff" : nutriSafeColors.onPrimaryContainer}
              />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "bookmark" : "bookmark-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      {/* Hide meal-planner from the tab bar; accessible via navigation */}
      <Tabs.Screen
        name="meal-planner"
        options={{
          href: null,
        }}
      />
      {/* Hide legacy camera route if it still exists */}
      <Tabs.Screen
        name="camera"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
