import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import {
  foodSafetyStore,
  FOOD_SUGGESTIONS,
  type PatientCondition,
  type FoodSafetyAnalysis,
} from "../../data/foodSafety";import { DietaryProfileBar } from "../../components/DietaryProfileBar";
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
  const router = useRouter();
  const [conditions, setConditions] = useState<PatientCondition[]>(foodSafetyStore.getSelectedConditions());
  const [searchText, setSearchText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<AnalysisStep | undefined>();
  const [result, setResult] = useState<FoodSafetyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState(foodSafetyStore.getPatient());
  const [history, setHistory] = useState<FoodSafetyAnalysis[]>(foodSafetyStore.getHistory());

  useEffect(() => {
    return foodSafetyStore.subscribe(() => {
      setPatient(foodSafetyStore.getPatient());
      setHistory(foodSafetyStore.getHistory());
      setConditions(foodSafetyStore.getSelectedConditions());
    });
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
    } catch {
      /* local selection still applies */
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!searchText.trim()) {
      setError("Search for a food to see how it fits your dietary needs.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setActiveStep(undefined);

    try {
      const analysis = await analyzeFoodByText(searchText, conditions, setActiveStep);
      setResult(analysis);
      await notificationStore.push("Food check complete", `${analysis.foodName}: ${analysis.statusHeadline}`);
    } catch {
      setError("We couldn't complete the analysis right now. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setActiveStep(undefined);
    }
  };

  const handleRecentPress = (foodName: string) => {
    setSearchText(foodName);
    setResult(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.greeting}>
          {getGreeting()}, {patient.name.split(" ")[0]}
        </Text>

        <DietaryProfileBar conditions={conditions} onConditionsChange={handleConditionsChange} />

        <Text style={styles.mainHeading}>Can I eat this?</Text>

        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, error && !searchText.trim() ? styles.searchError : null]}>
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
              <Pressable onPress={() => handleSearchTextChange("")} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={20} color={colors.slateMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
          {FOOD_SUGGESTIONS.map((food) => (
            <Pressable key={food} style={styles.suggestionPill} onPress={() => handleSearchTextChange(food)}>
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
            style={styles.primaryAction}
          />

          <AppButton
            label="Scan Food"
            onPress={() => router.push("/(tabs)/scan")}
            variant="secondary"
            size="lg"
            icon="camera-outline"
            style={styles.secondaryAction}
          />
        </View>

        {error && (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        )}

        <StepProgressState visible={isAnalyzing} steps={TEXT_ANALYSIS_STEPS} activeStepId={activeStep} />

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
            {recentChecks.map((item) => (
              <Pressable key={item.id} style={styles.recentItem} onPress={() => handleRecentPress(item.foodName)}>
                <Text style={styles.recentFood}>{item.foodName}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.gray3} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  searchInput: { flex: 1, fontSize: typography.body.fontSize, marginLeft: 10, color: colors.dark },
  suggestionsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  suggestionPill: {
    backgroundColor: colors.gray1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
  },
  suggestionText: { fontSize: typography.micro.fontSize, color: colors.slateMuted, fontWeight: "500" },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryAction: { flex: 1 },
  secondaryAction: { flex: 1 },
  errorWrap: { marginTop: spacing.md },
  resultSection: { marginTop: spacing.xl, gap: spacing.md },
  recentSection: { marginTop: spacing.xxl, gap: spacing.sm },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: { ...typography.caption, fontWeight: "700", color: colors.slateLight, textTransform: "uppercase", letterSpacing: 0.5 },
  recentCount: { ...typography.caption, color: colors.slateMuted },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recentFood: { fontSize: typography.bodySmall.fontSize + 1, fontWeight: "600", color: colors.dark },
  bottomSpacer: { height: 100 },
});
