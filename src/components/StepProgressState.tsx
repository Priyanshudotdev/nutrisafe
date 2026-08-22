import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/tokens";

interface StepConfig {
  id: string;
  label: string;
}

const DEFAULT_STEPS: StepConfig[] = [
  { id: "nutrition", label: "Checking nutritional information…" },
  { id: "guidelines", label: "Comparing dietary guidelines…" },
  { id: "recommendation", label: "Preparing your recommendation…" },
];

interface StepProgressStateProps {
  visible: boolean;
  steps?: StepConfig[];
  activeStepId?: string;
}

export function StepProgressState({
  visible,
  steps = DEFAULT_STEPS,
  activeStepId,
}: StepProgressStateProps): JSX.Element | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible || activeStepId) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1400);
    return () => clearInterval(interval);
  }, [visible, activeStepId]);

  if (!visible) return null;

  const activeIndex = activeStepId
    ? Math.max(0, steps.findIndex((s) => s.id === activeStepId))
    : tick % steps.length;

  const currentLabel = steps[activeIndex]?.label ?? steps[0].label;
  const progress = ((activeIndex + 1) / steps.length) * 100;

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={currentLabel}>
      <View style={styles.stepsList}>
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <View key={step.id} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  isDone && styles.stepDotDone,
                  isActive && styles.stepDotActive,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={10} color={colors.white} />
                ) : isActive ? (
                  <View style={styles.stepDotInner} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

/** @deprecated Use StepProgressState */
export function AnalysisLoadingState({ visible }: { visible: boolean }): JSX.Element | null {
  return <StepProgressState visible={visible} />;
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepsList: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.gray3,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  stepDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  stepLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.slateMuted,
    fontWeight: "500",
  },
  stepLabelActive: {
    color: colors.dark,
    fontWeight: "600",
  },
  progressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: colors.gray1,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
