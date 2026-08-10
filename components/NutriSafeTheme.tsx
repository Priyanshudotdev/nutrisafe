import React from "react";
import { View, Text, Platform } from "react-native";
import { HeroUINativeProvider } from "heroui-native/provider";
import { tw } from "uniwind";

// NutriSafe Color Theme
const nutriSafeColors = {
  // Primary
  primary: "#00685f",
  onPrimary: "#ffffff",
  primaryContainer: "#008378",
  onPrimaryContainer: "#f4fffc",
  primaryFixed: "#89f5e7",
  primaryFixedDim: "#6bd8cb",
  onPrimaryFixed: "#00201d",
  onPrimaryFixedVariant: "#005049",
  
  // Secondary
  secondary: "#316763",
  onSecondary: "#ffffff",
  secondaryContainer: "#b5ede7",
  onSecondaryContainer: "#376d69",
  secondaryFixed: "#b5ede7",
  secondaryFixedDim: "#9ad1cb",
  onSecondaryFixed: "#00201e",
  onSecondaryFixedVariant: "#005049",
  
  // Tertiary
  tertiary: "#924628",
  onTertiary: "#ffffff",
  tertiaryContainer: "#b05e3d",
  onTertiaryContainer: "#fffbff",
  tertiaryFixed: "#ffdbce",
  tertiaryFixedDim: "#ffb59a",
  onTertiaryFixed: "#370e00",
  onTertiaryFixedVariant: "#773215",
  
  // Error
  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  
  // Background & Surface
  background: "#f8f9ff",
  onBackground: "#121c2a",
  surface: "#f8f9ff",
  onSurface: "#121c2a",
  surfaceVariant: "#d9e3f6",
  onSurfaceVariant: "#3d4947",
  surfaceBright: "#f8f9ff",
  surfaceDim: "#d0dbed",
  surfaceContainer: "#e6eeff",
  surfaceContainerLow: "#eff4ff",
  surfaceContainerHigh: "#dee9fc",
  surfaceContainerHighest: "#d9e3f6",
  surfaceContainerLowest: "#ffffff",
  inverseSurface: "#27313f",
  inverseOnSurface: "#eaf1ff",
  outline: "#6d7a77",
  outlineVariant: "#bcc9c6",
};

// Border Radius
const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  full: 9999,
};

// Spacing
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Typography
const typography = {
  labelCaps: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    fontFamily: Platform.OS === "ios" ? "Inter" : "Inter",
  },
  bodySm: {
    fontSize: 14,
    fontWeight: "400" as const,
    fontFamily: Platform.OS === "ios" ? "Inter" : "Inter",
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: "400" as const,
    fontFamily: Platform.OS === "ios" ? "Inter" : "Inter",
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: "400" as const,
    fontFamily: Platform.OS === "ios" ? "Inter" : "Inter",
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
    fontFamily: Platform.OS === "ios" ? "Outfit" : "Outfit",
  },
  h2: {
    fontSize: 24,
    fontWeight: "600" as const,
    fontFamily: Platform.OS === "ios" ? "Outfit" : "Outfit",
  },
  h1Mobile: {
    fontSize: 28,
    fontWeight: "700" as const,
    fontFamily: Platform.OS === "ios" ? "Outfit" : "Outfit",
  },
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
    fontFamily: Platform.OS === "ios" ? "Outfit" : "Outfit",
  },
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const NutriSafeThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <HeroUINativeProvider theme={nutriSafeColors}>
      <View style={{ flex: 1, backgroundColor: nutriSafeColors.background }}>
        {children}
      </View>
    </HeroUINativeProvider>
  );
};

export { nutriSafeColors, radii, spacing, typography };
