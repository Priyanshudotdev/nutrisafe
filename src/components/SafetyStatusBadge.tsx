import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SafetyStatus } from "../data/foodSafety";
import { getStatusColors, radius, spacing, typography } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

// A11y outline exception (documented): status icons stay outline-style
// ("checkmark-circle", "alert-circle", "close-circle") per design — do NOT change icons.

interface SafetyStatusBadgeProps {
  status: SafetyStatus;
  headline?: string;
  size?: "compact" | "normal" | "large";
}

const STATUS_ICONS: Record<SafetyStatus, keyof typeof Ionicons.glyphMap> = {
  safe: "checkmark-circle",
  moderation: "alert-circle",
  not_recommended: "close-circle",
};

const STATUS_LABELS: Record<SafetyStatus, string> = {
  safe: "Safe to Consume",
  moderation: "Consume in Moderation",
  not_recommended: "Not Recommended",
};

export function SafetyStatusBadge({
  status,
  headline,
  size = "normal",
}: SafetyStatusBadgeProps): JSX.Element {
  const { isDark } = useThemeColors();
  const sc = getStatusColors(status, isDark);
  const label = headline || STATUS_LABELS[status];
  const icon = STATUS_ICONS[status];

  if (size === "compact") {
    return (
      <View style={[styles.compactBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
        <Ionicons name={icon} size={14} color={sc.icon} />
        <Text style={[styles.compactText, { color: sc.text }]}>{label}</Text>
      </View>
    );
  }

  if (size === "large") {
    return (
      <View style={[styles.largeBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
        <Ionicons name={icon} size={32} color={sc.icon} />
        <View style={styles.largeContent}>
          <Text style={[styles.largeLabel, { color: sc.text }]}>{label}</Text>
          <Text style={[styles.largeStatus, { color: sc.text }]}>
            {status === "safe" ? "Approved" : status === "moderation" ? "Caution" : "Avoid"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.normalBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
      <Ionicons name={icon} size={20} color={sc.icon} />
      <Text style={[styles.normalText, { color: sc.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compactBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  compactText: {
    ...typography.micro,
    fontWeight: "700",
  },
  normalBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    gap: spacing.sm,
  },
  normalText: {
    ...typography.body,
    fontWeight: "700",
    flex: 1,
  },
  largeBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    gap: 14,
  },
  largeContent: {
    flex: 1,
  },
  largeLabel: {
    ...typography.subheading,
    fontWeight: "800",
  },
  largeStatus: {
    ...typography.bodySmall,
    fontWeight: "600",
    opacity: 0.8,
    marginTop: 2,
  },
});
