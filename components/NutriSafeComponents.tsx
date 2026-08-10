import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import type { ColorValue, StyleProp, TextStyle } from "react-native";
import { nutriSafeColors } from "./NutriSafeTheme";

const materialIconNames: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  arrow_back: "arrow-back",
  camera_alt: "camera-alt",
  check_circle: "check-circle",
  chevron_right: "chevron-right",
  close: "close",
  dashboard: "dashboard",
  gps_fixed: "gps-fixed",
  help: "help",
  info: "info",
  lightbulb: "lightbulb",
  logout: "logout",
  medical_services: "medical-services",
  notifications: "notifications",
  person: "person",
  photo_library: "photo-library",
  restaurant: "restaurant",
  restaurant_menu: "restaurant-menu",
  search: "search",
  target: "gps-fixed",
  warning: "warning",
};

export const MaterialIcon: React.FC<{
  name: string;
  size?: number;
  color?: string | ColorValue;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}> = ({ name, size = 24, color = nutriSafeColors.onSurface, style }) => {
  const iconName = materialIconNames[name] ?? "help-outline";

  return <MaterialIcons name={iconName} size={size} color={color as string} style={style} />;
};
