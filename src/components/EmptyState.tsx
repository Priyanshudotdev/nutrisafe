import { Ionicons } from "@expo/vector-icons";
import React, { type ComponentProps, type JSX } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, type ThemeColors } from "../theme/tokens";
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
  if (__DEV__ && actionLabel && !onAction) {
    console.warn("EmptyState: actionLabel provided without onAction — button will not render.");
  }
  const showAction = Boolean(actionLabel && onAction);
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={colors.gray3} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {showAction && (
        <AppButton label={actionLabel!} onPress={onAction} size="md" style={styles.actionButton} />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      ...typography.subheading,
      color: colors.dark,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      ...typography.body,
      color: colors.slateMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    actionButton: { marginTop: spacing.xl, minWidth: 180 },
  });
