import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FOOD_SUGGESTIONS } from "../data/foodSafety";
import {
  FOOD_UNITS,
  MEAL_SLOTS,
  formatDateLabel,
  formatQuantity,
  type ConsumptionStatus,
  type FoodLogDay,
  type FoodLogItem,
  type FoodUnit,
  type MealSlot,
} from "../data/foodLog";
import { addFoodLogItem, deleteFoodLogItem, updateFoodLogItem } from "../services/foodLogService";
import { controlHeight, radius, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";
import { AppButton } from "./AppButton";
import { ErrorBanner } from "./ErrorBanner";
import { SegmentControl } from "./SegmentControl";

export interface FoodLogEditorEvent {
  mode: "create" | "update" | "delete";
  foodName: string;
  status: ConsumptionStatus;
}

interface FoodLogEditorSheetProps {
  visible: boolean;
  /** Selected day, used when creating a new item. */
  date: string;
  /** Existing item in edit mode; null when adding. */
  initial: FoodLogItem | null;
  defaultMeal: MealSlot;
  onClose: () => void;
  onSaved: (day: FoodLogDay, event: FoodLogEditorEvent) => void;
}

type FormProps = Omit<FoodLogEditorSheetProps, "visible">;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Couldn't save this food. Check your connection and try again.";
}

function ChoiceChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}): JSX.Element {
  const { colors } = useThemeColors();
  return (
    <Pressable
      style={[
        chipStyles.chip,
        {
          backgroundColor: selected ? colors.primaryMuted : colors.gray1,
          borderColor: selected ? colors.primaryLight : colors.cardBorder,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text
        style={[chipStyles.chipText, { color: selected ? colors.primaryText : colors.slateMedium }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Bottom sheet for adding a food or editing an existing log entry.
 *
 * The form lives in a keyed child that only mounts while the sheet is open, so
 * every open starts with fresh values from `initial` — no reset effect needed.
 */
export function FoodLogEditorSheet(props: FoodLogEditorSheetProps): JSX.Element {
  const { visible, date, initial, onClose } = props;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <FoodLogEditorForm key={initial ? initial.id : `new-${date}`} {...props} /> : null}
    </Modal>
  );
}

function FoodLogEditorForm({
  date,
  initial,
  defaultMeal,
  onClose,
  onSaved,
}: FormProps): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);

  const [foodName, setFoodName] = useState(initial?.foodName ?? "");
  const [quantity, setQuantity] = useState(initial ? formatQuantity(initial.quantity) : "100");
  const [unit, setUnit] = useState<FoodUnit>(initial?.unit ?? "g");
  const [meal, setMeal] = useState<MealSlot>(initial?.meal ?? defaultMeal);
  const [status, setStatus] = useState<ConsumptionStatus>(initial?.status ?? "eaten");
  const [nameError, setNameError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (!busy) onClose();
  };

  const handleQuantityChange = (text: string) => {
    setQuantity(text.replace(/[^0-9.]/g, ""));
    setQuantityError(null);
  };

  const handleSave = async () => {
    if (busy) return;
    const name = foodName.trim();
    const parsedQuantity = Number(quantity);
    let invalid = false;

    if (!name) {
      setNameError("Enter a food name.");
      invalid = true;
    } else if (name.length > 120) {
      setNameError("Keep the food name under 120 characters.");
      invalid = true;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError("Enter a quantity greater than 0.");
      invalid = true;
    } else if (parsedQuantity > 10_000) {
      setQuantityError("Quantity must be 10,000 or less.");
      invalid = true;
    }

    if (invalid) return;

    setBusy(true);
    setError(null);
    try {
      if (initial) {
        const result = await updateFoodLogItem(initial.id, {
          foodName: name,
          quantity: parsedQuantity,
          unit,
          meal,
          status,
        });
        onSaved(result.day, { mode: "update", foodName: name, status });
      } else {
        const result = await addFoodLogItem({
          date,
          meal,
          foodName: name,
          quantity: parsedQuantity,
          unit,
          status,
        });
        onSaved(result.day, { mode: "create", foodName: name, status });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!initial || busy) return;
    const item = initial;
    Alert.alert(
      "Remove this food?",
      `"${item.foodName}" will be removed from ${formatDateLabel(item.date)}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await deleteFoodLogItem(item.id);
                onSaved(result.day, {
                  mode: "delete",
                  foodName: item.foodName,
                  status: item.status,
                });
                onClose();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{initial ? "Edit food" : "Add food"}</Text>
            <Text style={styles.subtitle}>{formatDateLabel(date)}</Text>
          </View>
          <Pressable
            onPress={close}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close-circle" size={28} color={colors.slateMedium} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.label}>Food name</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            value={foodName}
            onChangeText={(text) => {
              setFoodName(text);
              setNameError(null);
            }}
            placeholder="e.g. Poha with peanuts"
            placeholderTextColor={colors.slateMuted}
            autoFocus={!initial}
            maxLength={120}
            accessibilityLabel="Food name"
          />
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}

          {!initial && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestions}
              keyboardShouldPersistTaps="handled"
            >
              {FOOD_SUGGESTIONS.map((food) => (
                <ChoiceChip
                  key={food}
                  label={food}
                  selected={foodName === food}
                  onPress={() => {
                    setFoodName(food);
                    setNameError(null);
                  }}
                  accessibilityLabel={`Use ${food}`}
                />
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={[styles.input, quantityError ? styles.inputError : null]}
            value={quantity}
            onChangeText={handleQuantityChange}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor={colors.slateMuted}
            accessibilityLabel="Quantity consumed"
          />
          {quantityError ? <Text style={styles.fieldError}>{quantityError}</Text> : null}

          <Text style={styles.label}>Unit</Text>
          <View style={styles.chipWrap}>
            {FOOD_UNITS.map((option) => (
              <ChoiceChip
                key={option.id}
                label={option.label}
                selected={unit === option.id}
                onPress={() => setUnit(option.id)}
                accessibilityLabel={`Use ${option.label} as the unit`}
              />
            ))}
          </View>

          <Text style={styles.label}>Meal</Text>
          <View style={styles.chipWrap}>
            {MEAL_SLOTS.map((slot) => (
              <ChoiceChip
                key={slot.id}
                label={slot.label}
                selected={meal === slot.id}
                onPress={() => setMeal(slot.id)}
                accessibilityLabel={`Assign to ${slot.label}`}
              />
            ))}
          </View>

          <Text style={styles.label}>Consumption</Text>
          <SegmentControl<ConsumptionStatus>
            segments={[
              { id: "eaten", label: "Eaten" },
              { id: "not_eaten", label: "Not eaten" },
            ]}
            active={status}
            onChange={setStatus}
          />
          <Text style={styles.helper}>
            {status === "eaten"
              ? "Counted in this day's nutrition totals."
              : "Kept in your plan, but excluded from the totals."}
          </Text>

          {error && (
            <View style={styles.errorWrap}>
              <ErrorBanner message={error} />
            </View>
          )}

          <View style={styles.actions}>
            <AppButton
              label="Cancel"
              variant="secondary"
              size="md"
              onPress={close}
              disabled={busy}
              style={styles.actionButton}
            />
            <AppButton
              label={initial ? "Save changes" : "Add food"}
              size="md"
              onPress={handleSave}
              loading={busy}
              style={styles.actionButton}
            />
          </View>

          {initial ? (
            <AppButton
              label="Remove food"
              variant="danger"
              size="md"
              icon="trash-outline"
              onPress={handleDelete}
              disabled={busy}
              style={styles.removeButton}
            />
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: "center",
  },
  chipText: { fontSize: typography.micro.fontSize, fontWeight: "600" },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
      maxHeight: "92%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    headerText: { flex: 1, minWidth: 0 },
    title: { ...typography.subheading, color: colors.dark },
    subtitle: { ...typography.caption, color: colors.slateMuted, marginTop: 2 },
    content: { paddingBottom: spacing.lg },
    label: {
      ...typography.bodySmall,
      fontWeight: "700",
      color: colors.slateMedium,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    input: {
      height: controlHeight.lg,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      color: colors.dark,
      backgroundColor: colors.cardBg,
      fontSize: typography.body.fontSize,
    },
    inputError: { borderColor: colors.dangerBorder },
    fieldError: {
      ...typography.caption,
      color: colors.dangerText,
      marginTop: spacing.xs,
    },
    suggestions: { gap: spacing.sm, paddingTop: spacing.sm },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    helper: { ...typography.caption, color: colors.slateMuted, marginTop: spacing.sm },
    errorWrap: { marginTop: spacing.lg },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
    actionButton: { flex: 1 },
    removeButton: { marginTop: spacing.sm },
  });
