import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

export function MedicalDisclaimer(): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={16} color={colors.slateMuted} />
      <Text style={styles.text}>
        Food recommendations are for informational and decision-support purposes and do not replace
        advice from your doctor or dietitian.
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: colors.slateMuted,
    lineHeight: 17,
    fontWeight: "500",
  },
});
