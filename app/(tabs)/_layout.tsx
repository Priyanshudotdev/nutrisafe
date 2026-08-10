import { Tabs } from "expo-router";
import React from "react";
import { MaterialIcon } from "@/components/NutriSafeComponents";
import { nutriSafeColors } from "@/components/NutriSafeTheme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: nutriSafeColors.primary,
        tabBarInactiveTintColor: nutriSafeColors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: nutriSafeColors.surface,
          borderTopColor: nutriSafeColors.outlineVariant,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="camera_alt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="meal-planner"
        options={{
          title: "Meals",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="restaurant_menu" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
