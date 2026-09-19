import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  StatusBar,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { radius, spacing, typography, getStatusColors, type ThemeColors } from "../../theme/tokens";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  foodSafetyStore,
  FOOD_SUGGESTIONS,
  type PatientCondition,
  type FoodSafetyAnalysis,
} from "../../data/foodSafety";
import { DietaryProfileBar } from "../../components/DietaryProfileBar";
import { FoodCheckCard } from "../../components/FoodCheckCard";
import { StepProgressState } from "../../components/StepProgressState";
import { AppButton } from "../../components/AppButton";
import { ErrorBanner } from "../../components/ErrorBanner";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import {
  analyzeFoodByText,
  TEXT_ANALYSIS_STEPS,
  type AnalysisStep,
} from "../../services/foodAnalysis";
import { updateProfile } from "../../services/profileService";
import { notificationStore } from "../../services/notificationStore";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function HomeScreen() {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [conditions, setConditions] = useState<PatientCondition[]>(
    foodSafetyStore.getSelectedConditions()
  );
  const [searchText, setSearchText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<AnalysisStep | undefined>();
  const [result, setResult] = useState<FoodSafetyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState(foodSafetyStore.getPatient());
  const [history, setHistory] = useState<FoodSafetyAnalysis[]>(foodSafetyStore.getHistory());
  const busyRef = useRef(false);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return foodSafetyStore.subscribe(() => {
      setPatient(foodSafetyStore.getPatient());
      setHistory(foodSafetyStore.getHistory());
      setConditions(foodSafetyStore.getSelectedConditions());
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const recentChecks = useMemo(() => history.slice(0, 3), [history]);

  const handleConditionsChange = async (newConditions: PatientCondition[]) => {
    if (newConditions.length === 0) return;
    setConditions(newConditions);
    foodSafetyStore.setSelectedConditions(newConditions);
    setResult(null);
    setError(null);
    try {
      const profile = await updateProfile({ conditions: newConditions });
      foodSafetyStore.hydratePatient(profile);
    } catch (e) {
      // Local selection still applies, but log so sync failures are visible.
      console.warn("handleConditionsChange: profile sync failed, keeping local selection", e);
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    const query = searchText.trim();
    if (!query) {
      setError("Search for a food to see how it fits your dietary needs.");
      return;
    }
    if (isAnalyzing || busyRef.current) {
      return;
    }
    busyRef.current = true;
    const runId = ++runIdRef.current;
    Keyboard.dismiss();

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setActiveStep(undefined);

    try {
      const liveConditions = foodSafetyStore.getSelectedConditions();
      const analysis = await analyzeFoodByText(query, liveConditions, setActiveStep);
      if (runId !== runIdRef.current || !mountedRef.current) {
        return;
      }
      setResult(analysis);
      if (analysis.status === "not_recommended") {
        await notificationStore.push(
          "Food check complete",
          `${analysis.foodName}: ${analysis.statusHeadline}`
        );
      }
    } catch {
      if (runId !== runIdRef.current || !mountedRef.current) {
        return;
      }
      setError("We couldn't complete the analysis right now. Please try again.");
    } finally {
      if (runId === runIdRef.current && mountedRef.current) {
        setIsAnalyzing(false);
        setActiveStep(undefined);
      }
      if (runId === runIdRef.current) {
        busyRef.current = false;
      }
    }
  };

  const handleRecentPress = (foodName: string) => {
    setSearchText(foodName);
    setResult(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.greeting}>
          {getGreeting()}, {(patient.name || "there").split(" ")[0]}
        </Text>

        <DietaryProfileBar conditions={conditions} onConditionsChange={handleConditionsChange} />

        <Text style={styles.mainHeading}>Can I eat this?</Text>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchContainer,
              error && !searchText.trim() ? styles.searchError : null,
            ]}
          >
            <Ionicons name="search-outline" size={20} color={colors.slateMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a food..."
              placeholderTextColor={colors.slateMuted}
              value={searchText}
              onChangeText={handleSearchTextChange}
              returnKeyType="search"
              onSubmitEditing={handleAnalyze}
              accessibilityLabel="Food search input"
            />
            {searchText.length > 0 && (
              <Pressable
                onPress={() => handleSearchTextChange("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                accessibilityHint="Clears search box"
              >
                <Ionicons name="close-circle" size={20} color={colors.slateMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsRow}
        >
          {FOOD_SUGGESTIONS.map((food) => (
            <Pressable
              key={food}
              style={styles.suggestionPill}
              onPress={() => handleSearchTextChange(food)}
              accessibilityRole="button"
              accessibilityLabel={`${food} suggestion`}
              accessibilityHint="Fills search box with this food"
            >
              <Text style={styles.suggestionText}>{food}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.actionRow}>
          <AppButton
            label={isAnalyzing ? "Checking…" : "Check Food"}
            onPress={handleAnalyze}
            variant="primary"
            size="lg"
            icon="shield-checkmark-outline"
            loading={isAnalyzing}
            disabled={!searchText.trim()}
          />

          <AppButton
            label="Scan Food instead"
            onPress={() => router.push("/(tabs)/scan")}
            variant="ghost"
            size="md"
            icon="camera-outline"
          />
        </View>

        {error && (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        )}

        <StepProgressState
          visible={isAnalyzing}
          steps={TEXT_ANALYSIS_STEPS}
          activeStepId={activeStep}
        />

        {result && !isAnalyzing && (
          <View style={styles.resultSection}>
            <FoodCheckCard analysis={result} expanded />
            <MedicalDisclaimer />
          </View>
        )}

        {!result && !isAnalyzing && recentChecks.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionLabel}>Recent</Text>
              <Text style={styles.recentCount}>
                {history.length} saved check{history.length === 1 ? "" : "s"}
              </Text>
            </View>
            {recentChecks.map((item) => {
              const sc = getStatusColors(item.status, isDark);
              return (
                <Pressable
                  key={item.id}
                  style={styles.recentItem}
                  onPress={() => handleRecentPress(item.foodName)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.foodName}, ${item.statusHeadline}`}
                  accessibilityHint="Fills search box"
                >
                  <View style={[styles.recentDot, { backgroundColor: sc.icon }]} />
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentFood} numberOfLines={1} ellipsizeMode="tail">
                      {item.foodName}
                    </Text>
                    <Text
                      style={[styles.recentVerdict, { color: sc.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.statusHeadline}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray3} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    greeting: {
      fontSize: typography.caption.fontSize,
      fontWeight: "600",
      color: colors.slateLight,
      marginBottom: spacing.md,
    },
    mainHeading: {
      ...typography.display,
      color: colors.dark,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    searchRow: { marginBottom: spacing.sm },
    searchContainer: {
      flexDirection: "row",
      backgroundColor: colors.cardBg,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      borderRadius: radius.lg,
      paddingHorizontal: 14,
      alignItems: "center",
      height: 52,
    },
    searchError: { borderColor: colors.dangerBorder },
    searchInput: {
      flex: 1,
      fontSize: typography.body.fontSize,
      marginLeft: 10,
      color: colors.dark,
    },
    suggestionsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
    suggestionPill: {
      backgroundColor: colors.gray1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      marginRight: spacing.sm,
    },
    suggestionText: {
      fontSize: typography.micro.fontSize,
      color: colors.slateMuted,
      fontWeight: "500",
    },
    actionRow: { marginTop: spacing.md, gap: spacing.xs },
    errorWrap: { marginTop: spacing.md },
    resultSection: { marginTop: spacing.xl, gap: spacing.md },
    recentSection: { marginTop: spacing.xxl, gap: spacing.sm },
    recentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.slateLight,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    recentCount: { ...typography.caption, color: colors.slateMuted },
    recentItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.cardBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    recentDot: { width: 8, height: 8, borderRadius: 4 },
    recentTextWrap: { flex: 1, minWidth: 0, gap: 1 },
    recentFood: {
      fontSize: typography.bodySmall.fontSize + 1,
      fontWeight: "600",
      color: colors.dark,
    },
    recentVerdict: { fontSize: typography.micro.fontSize, fontWeight: "700" },
    bottomSpacer: { height: 100 },
  });
