import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatCalories,
  formatNumber,
  mealLabel,
  quantityLabel,
  scaleNutrition,
  type FoodLogItem,
} from "../data/foodLog";
import { radius, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

interface FoodLogRowProps {
  item: FoodLogItem;
  busy?: boolean;
  disabled?: boolean;
  onToggleStatus: () => void;
  onPress: () => void;
}

/**
 * One food-log row. The check control toggles Eaten/Not eaten immediately;
 * tapping the rest of the row opens the editor for quantity and meal changes.
 */
export function FoodLogRow({
  item,
  busy = false,
  disabled = false,
  onToggleStatus,
  onPress,
}: FoodLogRowProps): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  const isEaten = item.status === "eaten";
  const scaled = scaleNutrition(item.nutritionPerUnit, item.quantity);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.checkButton}
        onPress={onToggleStatus}
        disabled={disabled || busy}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isEaten, disabled: disabled || busy, busy }}
        accessibilityLabel={`${item.foodName}: mark as ${isEaten ? "not eaten" : "eaten"}`}
        accessibilityHint="Eaten items are included in the daily nutrition totals"
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : (
          <Ionicons
            name={isEaten ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={isEaten ? colors.primaryText : colors.gray4}
          />
        )}
      </Pressable>

      <Pressable
        style={styles.content}
        onPress={onPress}
        android_ripple={{ color: "rgba(0,0,0,0.03)" }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.foodName}, ${quantityLabel(item.quantity, item.unit)}, ${isEaten ? "eaten" : "not eaten"}`}
      >
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {item.foodName}
          </Text>
          <View
            style={[styles.statusPill, isEaten ? styles.statusPillEaten : styles.statusPillIdle]}
          >
            <Text style={[styles.statusText, isEaten && styles.statusTextEaten]}>
              {isEaten ? "Eaten" : "Not eaten"}
            </Text>
          </View>
        </View>

        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {quantityLabel(item.quantity, item.unit)} · {mealLabel(item.meal)}
        </Text>

        {isEaten ? (
          <Text style={styles.nutrition} numberOfLines={2} ellipsizeMode="tail">
            {formatCalories(scaled.calories)} kcal · P {formatNumber(scaled.protein, 1)} g · C{" "}
            {formatNumber(scaled.carbs, 1)} g · F {formatNumber(scaled.fat, 1)} g · Fiber{" "}
            {formatNumber(scaled.fiber, 1)} g
          </Text>
        ) : (
          <Text style={styles.excluded}>Not counted in daily totals</Text>
        )}
      </Pressable>

      <Ionicons name="chevron-forward" size={16} color={colors.gray3} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.cardBg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    checkButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      paddingVertical: spacing.xs,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    name: {
      ...typography.title,
      color: colors.dark,
      flex: 1,
      minWidth: 0,
    },
    statusPill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      flexShrink: 0,
    },
    statusPillEaten: { backgroundColor: colors.primaryMuted },
    statusPillIdle: { backgroundColor: colors.bgSubtle },
    statusText: { ...typography.micro, color: colors.slateLight },
    statusTextEaten: { color: colors.primaryText },
    meta: { ...typography.caption, color: colors.slateLight },
    nutrition: {
      ...typography.caption,
      color: colors.slateMedium,
      fontWeight: "600",
      lineHeight: 17,
    },
    excluded: { ...typography.caption, color: colors.slateMuted },
  });
