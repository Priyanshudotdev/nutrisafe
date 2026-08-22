import type { JSX } from "react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/**
 * The single `display` element per screen (DESIGN_RULES.md §3).
 * Optional trailing slot for one quiet action.
 */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps): JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  textWrap: { flex: 1 },
  title: {
    ...typography.display,
    color: colors.dark,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.slateMuted,
    marginTop: 4,
  },
});
