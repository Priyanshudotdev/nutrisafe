import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PATIENT_CONDITIONS, type PatientCondition } from "../data/foodSafety";
import { colors, radius, spacing } from "../theme/tokens";

interface ConditionSelectorProps {
  selectedConditions: PatientCondition[];
  onToggleCondition: (condition: PatientCondition) => void;
}

/** Multi-select condition picker — toggles are instant; parent closes when done. */
export function ConditionSelector({
  selectedConditions,
  onToggleCondition,
}: ConditionSelectorProps): JSX.Element {
  const count = selectedConditions.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Your dietary profile</Text>
        <Text style={styles.selectedTitle}>
          {count === 0
            ? "Select at least one"
            : count === 1
              ? PATIENT_CONDITIONS.find((c) => c.id === selectedConditions[0])?.title
              : `${count} conditions selected`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {PATIENT_CONDITIONS.map((cond) => {
          const isSelected = selectedConditions.includes(cond.id);
          return (
            <Pressable
              key={cond.id}
              style={[
                styles.pillButton,
                isSelected && [styles.pillButtonActive, { borderColor: cond.accentColor }],
              ]}
              onPress={() => onToggleCondition(cond.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={cond.title}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isSelected ? cond.accentColor : colors.gray1 },
                ]}
              >
                <Ionicons
                  name={cond.iconName as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={isSelected ? colors.white : colors.slateLight}
                />
              </View>

              <View style={styles.pillTextWrap}>
                <Text
                  style={[
                    styles.pillText,
                    isSelected && [styles.pillTextActive, { color: cond.accentColor }],
                  ]}
                >
                  {cond.badgeLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.checkCircle,
                  isSelected && { backgroundColor: cond.accentColor, borderColor: cond.accentColor },
                ]}
              >
                {isSelected && <Ionicons name="checkmark" size={10} color={colors.white} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  headerRow: {
    marginBottom: spacing.md,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slateLight,
  },
  selectedTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.dark,
    letterSpacing: -0.2,
  },
  scrollList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pillButtonActive: {
    backgroundColor: colors.cardBg,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillTextWrap: {
    maxWidth: 120,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.slateMedium,
  },
  pillTextActive: {
    fontWeight: "700",
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.gray3,
    alignItems: "center",
    justifyContent: "center",
  },
});
