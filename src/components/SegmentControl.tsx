import type { JSX } from "react";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

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
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{seg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.cardBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slateMuted,
  },
  segmentTextActive: {
    color: colors.dark,
    fontWeight: "700",
  },
});
