import type { JSX } from "react";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, shadow, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

interface SegmentControlProps<T extends string> {
  segments: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

export function SegmentControl<T extends string>({
  segments,
  active,
  onChange,
}: SegmentControlProps<T>): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {segments.map((seg) => {
        const isActive = seg.id === active;
        return (
          <Pressable
            key={seg.id}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(seg.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={seg.label}
            accessibilityHint={`Select ${seg.label}`}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: colors.bgSubtle,
      borderRadius: radius.lg,
      padding: spacing.xs,
      gap: spacing.xs,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: colors.cardBg,
      ...shadow.subtle,
    },
    segmentText: {
      ...typography.bodySmall,
      fontWeight: "600",
      color: colors.slateMuted,
    },
    segmentTextActive: {
      color: colors.dark,
      fontWeight: "700",
    },
  });
