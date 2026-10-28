import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import React, { useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import {
  PATIENT_CONDITIONS,
  type ConditionOutcome,
  type EvidenceItem,
  type FoodSafetyAnalysis,
  type NutrientFactor,
  type SafetyStatus,
} from "../data/foodSafety";
import {
  getConditionColor,
  getStatusColors,
  radius,
  spacing,
  type ThemeColors,
} from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";
import { SafetyStatusBadge } from "./SafetyStatusBadge";

function getConditionLabel(conditionId: string): string {
  return (
    PATIENT_CONDITIONS.find((c) => c.id === conditionId)?.shortName ?? conditionId.toUpperCase()
  );
}

function getAnalysisConditions(analysis: FoodSafetyAnalysis): string[] {
  const list = analysis.conditions?.length ? analysis.conditions : [analysis.condition];
  return [...new Set(list)];
}

const STATUS_ICONS: Record<SafetyStatus, keyof typeof Ionicons.glyphMap> = {
  safe: "checkmark-circle",
  moderation: "alert-circle",
  not_recommended: "close-circle",
  unable_to_verify: "help-circle",
};

const STATUS_SHORT_LABELS: Record<SafetyStatus, string> = {
  safe: "Safe",
  moderation: "Moderation",
  not_recommended: "Not Recommended",
  unable_to_verify: "Unable to Verify",
};

function formatEvidenceValue(item: EvidenceItem): string {
  if (typeof item.value === "number") {
    return `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
  }
  return String(item.value);
}

/** One-line support text for the compact per-condition row. */
function conditionEvidenceLine(outcome: ConditionOutcome): string {
  const item =
    outcome.evidence.find((e) => e.status === outcome.status) ??
    outcome.evidence.find((e) => e.status !== "safe") ??
    outcome.evidence[0];

  if (!item) return outcome.missing[0] ?? "";

  if (item.nutrient === "allergen") {
    return item.value === "Contains" ? `${item.label} (contains)` : item.label;
  }
  if (item.nutrient === "gluten") {
    return `Gluten: ${item.value}`;
  }
  return `${formatEvidenceValue(item)} ${item.label.toLowerCase()} per ${item.servingLabel}`;
}

function ConditionRow({ outcome }: { outcome: ConditionOutcome }): JSX.Element {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
  const sc = getStatusColors(outcome.status, isDark);
  const detail = conditionEvidenceLine(outcome);

  return (
    <View
      style={styles.conditionRow}
      accessibilityLabel={`${outcome.label}, ${STATUS_SHORT_LABELS[outcome.status]}`}
    >
      <View style={[styles.conditionStatusIcon, { backgroundColor: sc.bg }]}>
        <Ionicons name={STATUS_ICONS[outcome.status]} size={15} color={sc.icon} />
      </View>
      <View style={styles.conditionRowBody}>
        <View style={styles.conditionRowHeader}>
          <Text style={styles.conditionName} numberOfLines={1} ellipsizeMode="tail">
            {outcome.label}
          </Text>
          <Text style={[styles.conditionStatusText, { color: sc.text }]} numberOfLines={1}>
            {STATUS_SHORT_LABELS[outcome.status]}
          </Text>
        </View>
        {detail ? (
          <Text style={styles.conditionDetail} numberOfLines={2} ellipsizeMode="tail">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function NutrientRow({ factor }: { factor: NutrientFactor }): JSX.Element {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
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

export function FoodCheckCard({
  analysis,
  expanded = false,
  onPress,
}: FoodCheckCardProps): JSX.Element {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
  const [whyExpanded, setWhyExpanded] = useState(expanded);
  const sc = getStatusColors(analysis.status, isDark);
  const conditions = getAnalysisConditions(analysis);
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
      {/* Hero: food name + compact verdict */}
      <View style={styles.heroSection}>
        <View style={styles.heroTop}>
          <View style={styles.foodNameWrap}>
            <Text style={styles.foodName} numberOfLines={2} ellipsizeMode="tail">
              {analysis.foodName}
            </Text>
            <Text style={styles.foodCategory} numberOfLines={1} ellipsizeMode="tail">
              {analysis.category}
              {analysis.serving ? ` · ${analysis.serving.label}` : ""}
            </Text>
          </View>
          <View style={styles.conditionTagsRow}>
            {conditions.map((conditionId) => {
              const cc = getConditionColor(conditionId, isDark);
              return (
                <View key={conditionId} style={[styles.conditionTag, { backgroundColor: cc.bg }]}>
                  <Text
                    style={[styles.conditionTagText, { color: cc.accent }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {getConditionLabel(conditionId)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.verdictBlock}>
          <SafetyStatusBadge status={analysis.status} headline={analysis.statusHeadline} />
          <Text
            style={styles.summary}
            numberOfLines={showDetails ? undefined : 2}
            ellipsizeMode="tail"
          >
            {analysis.summary}
          </Text>
        </View>
      </View>

      {analysis.conditionOutcomes && analysis.conditionOutcomes.length > 0 && (
        <View style={styles.conditionSection}>
          <Text style={styles.conditionHeading}>By condition</Text>
          {analysis.conditionOutcomes.map((outcome) => (
            <ConditionRow key={outcome.condition} outcome={outcome} />
          ))}
        </View>
      )}

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

          {analysis.evidence && analysis.evidence.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Evidence used</Text>
              {analysis.evidence.map((item, i) => (
                <View key={`${item.ruleId}-${i}`} style={styles.evidenceRow}>
                  <View style={styles.evidenceHeader}>
                    <Text style={styles.evidenceLabel}>{item.label}</Text>
                    <Text style={styles.evidenceValue}>{formatEvidenceValue(item)}</Text>
                  </View>
                  <Text style={styles.evidenceMeta}>
                    {item.servingLabel ? `Per ${item.servingLabel} · ` : ""}
                    {item.ruleId} · v{item.ruleVersion}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {analysis.dataGaps && analysis.dataGaps.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>What we couldn&apos;t verify</Text>
              {analysis.dataGaps.map((gap, i) => (
                <View key={`gap-${i}`} style={styles.gapRow}>
                  <Ionicons name="help-circle-outline" size={15} color={colors.unableIcon} />
                  <Text style={styles.gapText}>{gap}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Why this matters</Text>
            <Text style={styles.detailText}>{analysis.detailedWhy}</Text>
          </View>

          {(analysis.serving || analysis.foodReference) && (
            <View
              style={[
                styles.referenceBox,
                { backgroundColor: colors.bgSubtle, borderColor: colors.cardBorder },
              ]}
            >
              <Text style={styles.referenceHeading}>Reference basis</Text>
              {analysis.serving && (
                <Text style={styles.referenceLine}>Serving: {analysis.serving.label}</Text>
              )}
              {analysis.foodReference && (
                <>
                  <Text style={styles.referenceLine}>Source: {analysis.foodReference.source}</Text>
                  <Text style={styles.referenceMeta}>{analysis.foodReference.uncertainty}</Text>
                </>
              )}
              {analysis.ruleVersion && (
                <Text style={styles.referenceMeta}>Rules v{analysis.ruleVersion}</Text>
              )}
            </View>
          )}

          {analysis.alternatives.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailHeading}>Better alternatives</Text>
              {analysis.alternatives.map((alt, i) => (
                <View key={`alt-${i}`} style={styles.altRow}>
                  <View style={styles.altIconWrap}>
                    <Ionicons
                      name={alt.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.primary}
                    />
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
            <View
              style={[
                styles.portionBox,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="resize-outline" size={18} color={colors.primaryText} />
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
          <Text style={styles.expandButtonText}>
            {whyExpanded ? "Show less" : "See full analysis"}
          </Text>
          <Ionicons
            name={whyExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.primaryText}
          />
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
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
  const sc = getStatusColors(analysis.status, isDark);
  const conditionLabels = getAnalysisConditions(analysis).map(getConditionLabel).join(" · ");

  return (
    <Pressable
      style={styles.historyRow}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      accessibilityRole="button"
      accessibilityLabel={`${analysis.foodName}, ${conditionLabels}, ${analysis.statusHeadline}`}
    >
      <View style={[styles.historyIcon, { backgroundColor: sc.bg }]}>
        <Ionicons name={STATUS_ICONS[analysis.status]} size={22} color={sc.icon} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyName} numberOfLines={1} ellipsizeMode="tail">
          {analysis.foodName}
        </Text>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyCondition} numberOfLines={1} ellipsizeMode="tail">
            {conditionLabels}
          </Text>
          <Text style={styles.historyDot}>·</Text>
          <Text style={styles.historyMeta} numberOfLines={1} ellipsizeMode="tail">
            {analysis.timestamp}
          </Text>
        </View>
        <Text
          style={[styles.historyStatus, { color: sc.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {analysis.statusHeadline}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.gray3} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    verdictBlock: {
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    conditionSection: {
      gap: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorderSubtle,
    },
    conditionHeading: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.slateMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    conditionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    conditionStatusIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    conditionRowBody: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    conditionRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    conditionName: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.dark,
    },
    conditionStatusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    conditionDetail: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.slateLight,
      lineHeight: 17,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    foodNameWrap: {
      flex: 1,
      minWidth: 0,
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
    conditionTagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      alignItems: "flex-start",
      gap: 4,
      marginLeft: spacing.sm,
      maxWidth: "45%",
    },
    conditionTag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.sm,
      flexShrink: 0,
      maxWidth: 110,
    },
    conditionTagText: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    summary: {
      fontSize: 15,
      color: colors.slateMedium,
      lineHeight: 22,
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
    evidenceRow: {
      gap: 2,
      paddingVertical: spacing.xs,
    },
    evidenceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
    },
    evidenceLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.dark,
    },
    evidenceValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.slateDark,
    },
    evidenceMeta: {
      fontSize: 11,
      color: colors.slateMuted,
      fontWeight: "500",
    },
    gapRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    gapText: {
      flex: 1,
      fontSize: 12,
      color: colors.slateMedium,
      lineHeight: 18,
      fontWeight: "500",
    },
    referenceBox: {
      gap: 3,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    referenceHeading: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.slateDark,
      marginBottom: 2,
    },
    referenceLine: {
      fontSize: 12,
      color: colors.slateMedium,
      lineHeight: 17,
      fontWeight: "500",
    },
    referenceMeta: {
      fontSize: 11,
      color: colors.slateMuted,
      lineHeight: 16,
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
      color: colors.primaryText,
      marginBottom: 2,
    },
    portionText: {
      fontSize: 12,
      color: colors.primaryText,
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
      color: colors.primaryText,
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
      minWidth: 0,
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
      flexShrink: 1,
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
