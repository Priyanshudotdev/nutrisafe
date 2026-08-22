import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  PATIENT_CONDITIONS,
  type PatientCondition,
} from "../data/foodSafety";
import { colors, getConditionColor, radius, spacing } from "../theme/tokens";
import { ConditionSelector } from "./ConditionSelector";
import { AppButton } from "./AppButton";

interface DietaryProfileBarProps {
  conditions: PatientCondition[];
  onConditionsChange: (conditions: PatientCondition[]) => void;
}

/** Compact bar showing all active conditions; opens a multi-select sheet. */
export function DietaryProfileBar({ conditions, onConditionsChange }: DietaryProfileBarProps): JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<PatientCondition[]>(conditions);

  const openPicker = () => {
    setDraft(conditions.length > 0 ? conditions : draft);
    setShowPicker(true);
  };

  const toggle = (c: PatientCondition) => {
    setDraft((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const apply = () => {
    if (draft.length === 0) return;
    onConditionsChange(draft);
    setShowPicker(false);
  };

  const visible = conditions.slice(0, 3);

  return (
    <>
      <View style={styles.bar}>
        <View style={styles.iconCircle}>
          <Ionicons name="medical-outline" size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>Checking for</Text>
          <View style={styles.chipRow}>
            {visible.map((c) => {
              const cc = getConditionColor(c);
              const meta = PATIENT_CONDITIONS.find((x) => x.id === c);
              return (
                <View key={c} style={[styles.chip, { backgroundColor: cc.bg }]}>
                  <Text style={[styles.chipText, { color: cc.accent }]}>{meta?.shortName}</Text>
                </View>
              );
            })}
            {conditions.length > 3 && (
              <View style={[styles.chip, { backgroundColor: colors.gray1 }]}>
                <Text style={[styles.chipText, { color: colors.slateMedium }]}>+{conditions.length - 3}</Text>
              </View>
            )}
            {conditions.length === 0 && (
              <Text style={styles.noneText}>None selected</Text>
            )}
          </View>
        </View>
        <Pressable
          style={styles.changeButton}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel="Change dietary profile"
        >
          <Text style={styles.changeText}>Change</Text>
        </Pressable>
      </View>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your dietary profile</Text>
              <Pressable onPress={() => setShowPicker(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.slateMedium} />
              </Pressable>
            </View>
            <Text style={styles.modalHint}>
              Select every condition that applies — foods are checked against all of them.
            </Text>
            <ConditionSelector selectedConditions={draft} onToggleCondition={toggle} />
            <AppButton
              label={draft.length > 0 ? `Done · ${draft.length} selected` : "Done"}
              onPress={apply}
              size="md"
              disabled={draft.length === 0}
              style={styles.doneButton}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.slateMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  noneText: {
    fontSize: 12,
    color: colors.slateMuted,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSubtle,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
  },
  modalHint: {
    fontSize: 13,
    color: colors.slateMuted,
    lineHeight: 18,
  },
  doneButton: { marginTop: spacing.xs },
});
