import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useQuery, useAction } from "convex/react";
import { router, useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { MaterialIcon } from "@/components/NutriSafeComponents";

type FoodSearchResult = {
  _id: Id<"foods">;
  name: string;
  category?: string;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useQuery(
    api.nutrition.search.search,
    searchQuery.length > 2 ? { foodName: searchQuery } : "skip"
  );

  const analyzeFood = useAction(api.analysis.analyze.analyze);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (food: FoodSearchResult) => {
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await analyzeFood({ foodId: food._id });
      setResult(res);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setAnalyzing(false);
      setSearchQuery("");
    }
  };

  const handleScanFood = () => {
    router.push("/camera");
  };

  const handleMealPlanner = () => {
    router.push("/meal-planner");
  };

  return (
    <View style={{ flex: 1, backgroundColor: nutriSafeColors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: nutriSafeColors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
          }}
        >
          <Text style={typography.h1} className="text-on-primary">
            NutriSafe
          </Text>
          <Text style={typography.bodyMd} className="text-on-primary opacity-90">
            Make safer food choices
          </Text>
        </View>

        {/* Welcome Section */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: -spacing.xl,
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View
              style={{
                backgroundColor: nutriSafeColors.primaryContainer,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <MaterialIcon
                name="check_circle"
                size={32}
                color={nutriSafeColors.onPrimaryContainer}
                filled
              />
              <Text style={typography.bodyMd} className="text-on-primary-container">
                Your profile is complete!
              </Text>
            </View>

            <Text style={typography.h3} className="text-on-surface mb-sm">
              What would you like to do?
            </Text>

            <TouchableOpacity
              onPress={handleScanFood}
              style={{
                backgroundColor: nutriSafeColors.secondaryContainer,
                borderRadius: radii.lg,
                padding: spacing.lg,
                marginBottom: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <MaterialIcon
                name="camera_alt"
                size={28}
                color={nutriSafeColors.onSecondaryContainer}
              />
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMd} className="text-on-secondary-container font-semibold">
                  Scan Food
                </Text>
                <Text style={typography.bodySm} className="text-on-secondary-container opacity-80">
                  Identify and analyze any food
                </Text>
              </View>
              <MaterialIcon
                name="chevron_right"
                size={20}
                color={nutriSafeColors.onSecondaryContainer}
                filled
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMealPlanner}
              style={{
                backgroundColor: nutriSafeColors.surfaceContainer,
                borderRadius: radii.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <MaterialIcon
                name="restaurant_menu"
                size={28}
                color={nutriSafeColors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                  Meal Planner
                </Text>
                <Text style={typography.bodySm} className="text-on-surface opacity-80">
                  Build safe meals from your ingredients
                </Text>
              </View>
              <MaterialIcon
                name="chevron_right"
                size={20}
                color={nutriSafeColors.primary}
                filled
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={typography.h3} className="text-on-surface mb-md">
            Search Foods
          </Text>

          <View
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.lg,
              padding: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <MaterialIcon
              name="search"
              size={20}
              color={nutriSafeColors.onSurfaceVariant}
              style={{ marginLeft: spacing.sm }}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for foods (e.g. Banana, Wheat)"
              placeholderTextColor={nutriSafeColors.onSurfaceVariant}
              style={{
                flex: 1,
                color: nutriSafeColors.onSurface,
                fontSize: 16,
                fontFamily: Platform.OS === "ios" ? "Inter" : "Inter",
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={{ marginRight: spacing.sm }}
              >
                <MaterialIcon
                  name="close"
                  size={20}
                  color={nutriSafeColors.onSurfaceVariant}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results */}
        {searchQuery.length > 2 && searchResults && !analyzing && !result && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            {searchResults.length === 0 ? (
              <Text style={typography.bodyMd} className="text-on-surface-variant text-center py-lg">
                No foods found.
              </Text>
            ) : (
              searchResults.map((food: FoodSearchResult) => (
                <TouchableOpacity
                  key={food._id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: nutriSafeColors.outlineVariant,
                  }}
                  onPress={() => handleAnalyze(food)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                      {food.name}
                    </Text>
                    {food.category && (
                      <Text style={typography.bodySm} className="text-on-surface-variant">
                        {food.category}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      backgroundColor: `${nutriSafeColors.primary}1a`,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <Text style={typography.labelCaps} className="text-primary">
                      Analyze
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Loading State */}
        {analyzing && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <ActivityIndicator size="large" color={nutriSafeColors.primary} />
            <Text
              style={typography.bodyMd}
              className="text-on-surface-variant mt-md font-medium"
            >
              Running Medical Rules Engine...
            </Text>
            <Text style={typography.bodySm} className="text-on-surface-variant mt-xs">
              Evaluating alternatives...
            </Text>
          </View>
        )}

        {/* Analysis Result */}
        {result && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            {/* Verdict Badge */}
            <View
              style={{
                backgroundColor:
                  result.verdict === "safe"
                    ? `${nutriSafeColors.primaryContainer}20`
                    : result.verdict === "moderation"
                    ? `${nutriSafeColors.tertiaryContainer}20`
                    : `${nutriSafeColors.errorContainer}20`,
                borderRadius: radii.full,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                alignSelf: "flex-start",
                marginTop: spacing.sm,
              }}
            >
              <Text
                style={{
                  ...typography.labelCaps,
                  color:
                    result.verdict === "safe"
                      ? nutriSafeColors.onPrimaryContainer
                      : result.verdict === "moderation"
                      ? nutriSafeColors.onTertiaryContainer
                      : nutriSafeColors.onErrorContainer,
                }}
              >
                {result.verdict.toUpperCase()}
              </Text>
            </View>

            {result.explanation ? (
              <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
                <Text style={typography.h3} className="text-on-surface font-bold">
                  {result.explanation.summary}
                </Text>

                <View
                  style={{
                    backgroundColor: nutriSafeColors.surfaceContainer,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                  }}
                >
                  <Text style={typography.labelCaps} className="text-on-surface mb-sm">
                    Why?
                  </Text>
                  <Text
                    style={typography.bodyMd}
                    className="text-on-surface-variant leading-6"
                  >
                    {result.explanation.why}
                  </Text>
                </View>

                {result.explanation.healthRisks?.length > 0 && (
                  <View
                    style={{
                      backgroundColor: `${nutriSafeColors.errorContainer}1a`,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: `${nutriSafeColors.error}30`,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                      <MaterialIcon
                        name="warning"
                        size={20}
                        color={nutriSafeColors.onErrorContainer}
                        filled
                      />
                      <Text style={typography.labelCaps} className="text-error-container">
                        Health Risks
                      </Text>
                    </View>
                    {result.explanation.healthRisks.map((risk: string, i: number) => (
                      <Text key={i} style={typography.bodySm} className="text-error-container mb-xs">
                        • {risk}
                      </Text>
                    ))}
                  </View>
                )}

                {result.explanation.portionAdvice && (
                  <View
                    style={{
                      backgroundColor: `${nutriSafeColors.tertiaryContainer}1a`,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: `${nutriSafeColors.tertiary}30`,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                      <MaterialIcon
                        name="info"
                        size={20}
                        color={nutriSafeColors.onTertiaryContainer}
                        filled
                      />
                      <Text style={typography.labelCaps} className="text-tertiary-container">
                        Portion Advice
                      </Text>
                    </View>
                    <Text style={typography.bodyMd} className="text-tertiary-container">
                      {result.explanation.portionAdvice}
                    </Text>
                  </View>
                )}

                {result.explanation.alternatives?.length > 0 && (
                  <View
                    style={{
                      backgroundColor: `${nutriSafeColors.primaryContainer}1a`,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      borderWidth: 1,
                      borderColor: `${nutriSafeColors.primary}30`,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                      <MaterialIcon
                        name="lightbulb"
                        size={20}
                        color={nutriSafeColors.onPrimaryContainer}
                        filled
                      />
                      <Text style={typography.labelCaps} className="text-primary-container">
                        Safe Alternatives
                      </Text>
                    </View>
                    {result.explanation.alternatives.map((alt: string, i: number) => (
                      <Text key={i} style={typography.bodyMd} className="text-on-primary-container mb-xs font-medium">
                        ✓ {alt}
                      </Text>
                    ))}
                  </View>
                )}

                <Text
                  style={typography.bodySm}
                  className="text-on-surface-variant mt-xs text-center italic"
                >
                  {result.explanation.disclaimer}
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: nutriSafeColors.outlineVariant,
                    borderRadius: radii.lg,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    marginTop: spacing.lg,
                  }}
                  onPress={() => setResult(null)}
                >
                  <Text style={typography.bodyMd} className="text-on-surface-variant font-semibold">
                    Analyze Another Food
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: "center", marginTop: spacing.lg }}>
                <Text style={typography.bodyMd} className="text-error-container">
                  Analysis completed, but AI explanation failed to generate.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: nutriSafeColors.outlineVariant,
                    borderRadius: radii.lg,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    marginTop: spacing.lg,
                  }}
                  onPress={() => setResult(null)}
                >
                  <Text style={typography.bodyMd} className="text-on-surface-variant font-semibold">
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
