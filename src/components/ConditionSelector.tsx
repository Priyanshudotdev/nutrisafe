import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PATIENT_CONDITIONS, type PatientCondition } from "../data/foodSafety";
import {
  radius,
  spacing,
  typography,
  sectionLabel as sectionLabelToken,
  getConditionColor,
  type ThemeColors,
} from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

interface ConditionSelectorProps {
  selectedConditions: PatientCondition[];
  onToggleCondition: (condition: PatientCondition) => void;
}

/** Multi-select condition picker — toggles are instant; parent closes when done. */
const FALLBACK_ICON = "help-circle-outline" as const;

export function ConditionSelector({
  selectedConditions,
  onToggleCondition,
}: ConditionSelectorProps): JSX.Element {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
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
          const cc = getConditionColor(cond.id, isDark);
          const iconName = (
            cond.iconName in Ionicons.glyphMap ? cond.iconName : FALLBACK_ICON
          ) as keyof typeof Ionicons.glyphMap;
          return (
            <Pressable
              key={cond.id}
              style={[
                styles.pillButton,
                isSelected && [styles.pillButtonActive, { borderColor: cc.accent }],
              ]}
              onPress={() => onToggleCondition(cond.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              accessibilityLabel={cond.title}
              accessibilityHint={`${isSelected ? "Remove" : "Add"} ${cond.title} ${isSelected ? "from" : "to"} dietary profile`}
              hitSlop={spacing.sm}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isSelected ? cc.accent : colors.gray1 },
                ]}
                accessible={false}
              >
                <Ionicons
                  name={iconName}
                  size={16}
                  color={isSelected ? colors.white : colors.slateLight}
                />
              </View>

              <View style={styles.pillTextWrap}>
                <Text
                  style={[
                    styles.pillText,
                    isSelected && [styles.pillTextActive, { color: cc.accent }],
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {cond.badgeLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.checkCircle,
                  isSelected && { backgroundColor: cc.accent, borderColor: cc.accent },
                ]}
                accessible={false}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
    },
    headerRow: {
      marginBottom: spacing.md,
      gap: spacing.xs,
    },
    sectionLabel: {
      ...sectionLabelToken,
    },
    selectedTitle: {
      ...typography.subheading,
      color: colors.dark,
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
      borderRadius: radius.pill,
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
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    pillTextWrap: {
      maxWidth: 120,
    },
    pillText: {
      ...typography.caption,
      fontWeight: "600",
      color: colors.slateMedium,
    },
    pillTextActive: {
      fontWeight: "700",
    },
    checkCircle: {
      width: 16,
      height: 16,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.gray3,
      alignItems: "center",
      justifyContent: "center",
    },
  });
