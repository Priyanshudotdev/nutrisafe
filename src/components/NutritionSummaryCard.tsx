import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  formatCalories,
  formatNumber,
  formatNutrient,
  type DailyNutritionSummary,
  type NutritionFacts,
} from "../data/foodLog";
import { radius, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

interface NutritionSummaryCardProps {
  summary: DailyNutritionSummary;
  dateLabel: string;
}

const MACROS: { key: keyof NutritionFacts; label: string }[] = [
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
  { key: "fiber", label: "Fiber" },
];

const OTHER_NUTRIENTS: {
  key: keyof NutritionFacts;
  label: string;
  unit: "g" | "mg";
}[] = [
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg" },
  { key: "saturatedFat", label: "Saturated fat", unit: "g" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
];

/**
 * Daily nutrition dashboard. Totals are already filtered to eaten food by the
 * caller (server response or `summarizeFoodItems` after an optimistic change).
 */
export function NutritionSummaryCard({
  summary,
  dateLabel,
}: NutritionSummaryCardProps): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  const { totals } = summary;
  const excluded = summary.notEatenCount;
  const totalItems = summary.eatenCount + excluded;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily nutrition</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>

      <View style={styles.calorieRow}>
        <View style={styles.calorieIcon}>
          <Ionicons name="flame-outline" size={22} color={colors.primaryText} />
        </View>
        <View style={styles.calorieTextWrap}>
          <Text style={styles.calorieValue}>{formatCalories(totals.calories)}</Text>
          <Text style={styles.calorieLabel}>kcal consumed</Text>
        </View>
        <View style={styles.countWrap}>
          <Text style={styles.countValue}>
            {summary.eatenCount}
            <Text style={styles.countTotal}> / {totalItems}</Text>
          </Text>
          <Text style={styles.countLabel}>items eaten</Text>
        </View>
      </View>

      {excluded > 0 ? (
        <Text style={styles.excludedNote}>
          {excluded} not eaten item{excluded === 1 ? "" : "s"} excluded from these totals.
        </Text>
      ) : totalItems > 0 ? (
        <Text style={styles.excludedNote}>Every logged item is marked eaten.</Text>
      ) : null}

      <View style={styles.macroRow}>
        {MACROS.map(({ key, label }) => (
          <View key={key} style={styles.macroTile}>
            <Text style={styles.macroLabel}>{label}</Text>
            <Text style={styles.macroValue}>
              {formatNumber(totals[key], 1)}
              <Text style={styles.macroUnit}> g</Text>
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.otherSection}>
        <Text style={styles.sectionLabel}>Other nutrients</Text>
        <View style={styles.otherGrid}>
          {OTHER_NUTRIENTS.map(({ key, label, unit }) => (
            <View key={key} style={styles.otherItem}>
              <Text style={styles.otherLabel}>{label}</Text>
              <Text style={styles.otherValue}>{formatNutrient(totals[key], unit)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.noteRow}>
        <Ionicons name="information-circle-outline" size={14} color={colors.slateMuted} />
        <Text style={styles.noteText}>
          Only food marked Eaten is included. Nutrient values are estimates.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    title: { ...typography.title, color: colors.dark },
    date: { ...typography.caption, color: colors.slateMuted, flexShrink: 1 },
    calorieRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    calorieIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    calorieTextWrap: { flex: 1, minWidth: 0 },
    calorieValue: {
      ...typography.heading,
      color: colors.dark,
      fontVariant: ["tabular-nums"],
    },
    calorieLabel: { ...typography.caption, color: colors.slateLight },
    countWrap: { alignItems: "flex-end" },
    countValue: {
      ...typography.title,
      color: colors.dark,
      fontVariant: ["tabular-nums"],
    },
    countTotal: { ...typography.caption, color: colors.slateMuted, fontWeight: "500" },
    countLabel: { ...typography.micro, color: colors.slateMuted },
    excludedNote: { ...typography.caption, color: colors.slateMuted },
    macroRow: { flexDirection: "row", gap: spacing.sm },
    macroTile: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.bgSubtle,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: "center",
      gap: 2,
    },
    macroLabel: { ...typography.micro, color: colors.slateMuted },
    macroValue: {
      ...typography.title,
      color: colors.dark,
      fontVariant: ["tabular-nums"],
    },
    macroUnit: { ...typography.micro, color: colors.slateMuted, fontWeight: "600" },
    otherSection: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorderSubtle,
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.slateLight,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    otherGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: spacing.lg,
      rowGap: spacing.xs,
    },
    otherItem: {
      flexGrow: 1,
      flexBasis: "44%",
      minWidth: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorderSubtle,
    },
    otherLabel: { ...typography.bodySmall, color: colors.slateLight, flexShrink: 1 },
    otherValue: {
      ...typography.bodySmall,
      fontWeight: "700",
      color: colors.dark,
      fontVariant: ["tabular-nums"],
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs,
    },
    noteText: { ...typography.caption, color: colors.slateMuted, flex: 1 },
  });
