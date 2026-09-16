import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

/**
 * Inline error message. Explains what failed; the caller provides the
 * recovery path (DESIGN_RULES.md §8).
 */
export function ErrorBanner({ message }: { message: string }): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={16} color={colors.dangerIcon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.md,
  },
  text: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.dangerText,
  },
});
