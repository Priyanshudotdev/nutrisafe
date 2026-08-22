import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React, { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { PATIENT_CONDITIONS, type FoodSafetyAnalysis, type NutrientFactor } from "../data/foodSafety";
import { colors, getConditionColor, getStatusColors, radius, spacing } from "../theme/tokens";
import { SafetyStatusBadge } from "./SafetyStatusBadge";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getConditionLabel(conditionId: string): string {
  return PATIENT_CONDITIONS.find((c) => c.id === conditionId)?.shortName ?? conditionId.toUpperCase();
}

function NutrientRow({ factor }: { factor: NutrientFactor }): JSX.Element {
  const impactColors = {
    positive: { bg: colors.safeBg, text: colors.safeText, icon: colors.safeIcon },
    neutral: { bg: colors.gray1, text: colors.slateLight, icon: colors.slateMuted },
    warning: { bg: colors.moderationBg, text: colors.moderationText, icon: colors.moderationIcon },
    danger: { bg: colors.dangerBg, text: colors.dangerText, icon: colors.dangerIcon },
  };
  const ic = impactColors[factor.impact];

  return (
    <View style={styles.nutrientRow} accessibilityLabel={`${factor.name}, ${factor.level}`}>
      <View style={[styles.nutrientDot, { backgroundColor: ic.icon }]} />
      <View style={styles.nutrientInfo}>
        <View style={styles.nutrientNameRow}>
          <Text style={styles.nutrientName}>{factor.name}</Text>
          <View style={[styles.levelPill, { backgroundColor: ic.bg }]}>
            <Text style={[styles.levelText, { color: ic.text }]}>{factor.level}</Text>
          </View>
        </View>
        <Text style={styles.nutrientDetail}>{factor.detail}</Text>
      </View>
    </View>
  );
}

interface FoodCheckCardProps {
  analysis: FoodSafetyAnalysis;
  expanded?: boolean;
  onPress?: () => void;
}

export function FoodCheckCard({ analysis, expanded = false, onPress }: FoodCheckCardProps): JSX.Element {
  const [whyExpanded, setWhyExpanded] = useState(expanded);
  const sc = getStatusColors(analysis.status);
  const cc = getConditionColor(analysis.condition);
  const conditionLabel = getConditionLabel(analysis.condition);
  const showDetails = expanded || whyExpanded;

  const toggleWhy = () => {
    if (expanded) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWhyExpanded((prev) => !prev);
  };

  return (
    <Pressable
      style={[styles.card, showDetails && { borderColor: sc.border }]}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: "rgba(0,0,0,0.03)" }}
    >
      {/* Hero: Food name + large status */}
      <View style={styles.heroSection}>
        <View style={styles.heroTop}>
          <View style={styles.foodNameWrap}>
            <Text style={styles.foodName}>{analysis.foodName}</Text>
            <Text style={styles.foodCategory}>{analysis.category}</Text>
          </View>
          <View style={[styles.conditionTag, { backgroundColor: cc.bg }]}>
            <Text style={[styles.conditionTagText, { color: cc.accent }]}>{conditionLabel}</Text>
          </View>
        </View>

        <SafetyStatusBadge status={analysis.status} headline={analysis.statusHeadline} size="large" />
      </View>

      <Text style={styles.summary}>{analysis.summary}</Text>

      {showDetails && (
        <>
          {analysis.factors.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Why this recommendation?</Text>
              {analysis.factors.map((f, i) => (
                <NutrientRow key={`${f.name}-${i}`} factor={f} />
              ))}
            </View>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Why this matters</Text>
            <Text style={styles.detailText}>{analysis.detailedWhy}</Text>
          </View>

          {analysis.alternatives.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Better alternatives</Text>
              {analysis.alternatives.map((alt, i) => (
                <View key={`alt-${i}`} style={styles.altRow}>
                  <View style={styles.altIconWrap}>
                    <Ionicons name={alt.icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.altTextWrap}>
                    <Text style={styles.altName}>{alt.name}</Text>
                    <Text style={styles.altReason}>{alt.reason}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

      {analysis.portionGuidance && (
        <View style={[styles.portionBox, { backgroundColor: colors.primaryMuted, borderColor: colors.primaryLight }]}>
          <Ionicons name="resize-outline" size={18} color={colors.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.portionLabel}>Portion guidance</Text>
            <Text style={styles.portionText}>{analysis.portionGuidance}</Text>
          </View>
        </View>
      )}

      {analysis.source === "scan" && analysis.scanConfidence !== undefined && (
        <Text style={styles.scanNote}>
          Identified via photo · {Math.round(analysis.scanConfidence * 100)}% confidence
        </Text>
      )}
        </>
      )}

      {!expanded && (
        <Pressable
          style={styles.expandButton}
          onPress={toggleWhy}
          accessibilityRole="button"
          accessibilityState={{ expanded: whyExpanded }}
        >
          <Text style={styles.expandButtonText}>{whyExpanded ? "Show less" : "See full analysis"}</Text>
          <Ionicons name={whyExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDark} />
        </Pressable>
      )}

      <Text style={styles.timestamp}>{analysis.timestamp}</Text>
    </Pressable>
  );
}

interface HistoryItemProps {
  analysis: FoodSafetyAnalysis;
  onPress: () => void;
}

export function HistoryItem({ analysis, onPress }: HistoryItemProps): JSX.Element {
  const sc = getStatusColors(analysis.status);
  const conditionLabel = getConditionLabel(analysis.condition);

  return (
    <Pressable
      style={styles.historyRow}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      accessibilityRole="button"
      accessibilityLabel={`${analysis.foodName}, ${conditionLabel}, ${analysis.statusHeadline}`}
    >
      <View style={[styles.historyIcon, { backgroundColor: sc.bg }]}>
        <Ionicons
          name={analysis.status === "safe" ? "checkmark-circle" : analysis.status === "moderation" ? "alert-circle" : "close-circle"}
          size={22}
          color={sc.icon}
        />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyName}>{analysis.foodName}</Text>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyCondition}>{conditionLabel}</Text>
          <Text style={styles.historyDot}>·</Text>
          <Text style={styles.historyMeta}>{analysis.timestamp}</Text>
        </View>
        <Text style={[styles.historyStatus, { color: sc.text }]}>{analysis.statusHeadline}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.gray3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1.2,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroSection: {
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  foodNameWrap: {
    flex: 1,
  },
  foodName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.dark,
    letterSpacing: -0.4,
  },
  foodCategory: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.slateLight,
    marginTop: 2,
  },
  conditionTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  conditionTagText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  summary: {
    fontSize: 14,
    color: colors.slateMedium,
    lineHeight: 21,
    fontWeight: "500",
  },
  timestamp: {
    fontSize: 11,
    color: colors.slateMuted,
    fontWeight: "500",
  },
  detailSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorderSubtle,
  },
  detailHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.dark,
    letterSpacing: -0.1,
  },
  detailText: {
    fontSize: 13,
    color: colors.slateMedium,
    lineHeight: 20,
    fontWeight: "500",
  },
  nutrientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  nutrientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  nutrientInfo: {
    flex: 1,
    gap: 2,
  },
  nutrientNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nutrientName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.dark,
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  nutrientDetail: {
    fontSize: 12,
    color: colors.slateLight,
    fontWeight: "500",
  },
  altRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  altIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  altTextWrap: {
    flex: 1,
    gap: 2,
  },
  altName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.dark,
  },
  altReason: {
    fontSize: 12,
    color: colors.slateLight,
    fontWeight: "500",
    lineHeight: 17,
  },
  portionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  portionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 2,
  },
  portionText: {
    fontSize: 12,
    color: colors.primaryDeep,
    lineHeight: 17,
    fontWeight: "500",
  },
  scanNote: {
    fontSize: 11,
    color: colors.slateMuted,
    fontWeight: "500",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
  historyName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.dark,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyCondition: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.slateLight,
  },
  historyDot: {
    fontSize: 12,
    color: colors.gray3,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.slateMuted,
    fontWeight: "500",
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
});
