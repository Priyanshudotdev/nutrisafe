import { Ionicons } from "@expo/vector-icons";
import React, { type ComponentProps, type JSX } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";
import { AppButton } from "./AppButton";

interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={colors.gray3} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <AppButton label={actionLabel} onPress={onAction} size="md" style={styles.actionButton} />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.slateMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  actionButton: { marginTop: spacing.xl, minWidth: 180 },
});
