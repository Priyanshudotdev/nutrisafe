import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, controlHeight, radius } from "../theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const HEIGHTS: Record<Size, number> = {
  sm: controlHeight.sm,
  md: controlHeight.md,
  lg: controlHeight.lg,
};

const LABEL_SIZE: Record<Size, number> = { sm: 13, md: 14, lg: 15 };

const VARIANT_COLORS: Record<Variant, { bg: string; border: string; text: string }> = {
  primary: { bg: colors.primaryDark, border: "transparent", text: colors.white },
  secondary: { bg: colors.cardBg, border: colors.cardBorder, text: colors.primaryDark },
  ghost: { bg: "transparent", border: "transparent", text: colors.primaryDark },
  danger: { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.dangerText },
};

/** The only button component in the app. One primary per view (DESIGN_RULES.md §5). */
export function AppButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: AppButtonProps): JSX.Element {
  const vc = VARIANT_COLORS[variant];
  const isInactive = disabled || loading;

  return (
    <Pressable
      style={[
        styles.base,
        { height: HEIGHTS[size], backgroundColor: vc.bg, borderColor: vc.border },
        variant === "secondary" && styles.secondaryBorder,
        isInactive && styles.inactive,
        style,
      ]}
      onPress={onPress}
      disabled={isInactive}
      android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vc.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 15 : 18} color={vc.text} /> : null}
          <Text style={[styles.label, { color: vc.text, fontSize: LABEL_SIZE[size] }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Quiet text-only action (e.g. "Search manually instead"). */
export function AppLinkButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}): JSX.Element {
  return (
    <Pressable
      style={[styles.link, style]}
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
    >
      {icon ? <Ionicons name={icon} size={16} color={colors.primaryDark} /> : null}
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: 20,
  },
  secondaryBorder: { borderColor: colors.cardBorder },
  inactive: { opacity: 0.5 },
  label: { fontWeight: "700" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  linkLabel: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
});
