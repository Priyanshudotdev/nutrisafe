import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { MaterialIcon } from "@/components/NutriSafeComponents";

export default function MealPlannerResults() {
  const { foodIds } = useLocalSearchParams();
  const generateMeals = useAction(api.meals.recommend.generate);

  const [loading, setLoading] = React.useState(true);
  const [results, setResults] = React.useState<any[]>([]);

  useEffect(() => {
    const rawFoodIds = Array.isArray(foodIds) ? foodIds[0] : foodIds;
    if (!rawFoodIds) return;
    const fetchMeals = async () => {
      try {
        const idsArray = rawFoodIds.split(",") as Id<"foods">[];
        const res = await generateMeals({ foodIds: idsArray });
        setResults(res);
      } catch (e: any) {
        console.error(e);
        // alert(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, [foodIds, generateMeals]);

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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <TouchableOpacity onPress={() => router.replace('/(tabs)/create')} style={{ marginRight: spacing.md }}>
              <MaterialIcon
                name="arrow_back"
                size={24}
                color={nutriSafeColors.onPrimary}
              />
            </TouchableOpacity>
            <Text style={typography.h2} className="text-on-primary">
              Safe Meals Found
            </Text>
          </View>
          <Text style={typography.bodyMd} className="text-on-primary opacity-90">
            Medically verified meal combinations
          </Text>
        </View>

        {/* Loading State */}
        {loading && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
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
              Building meal combinations...
            </Text>
            <Text style={typography.bodySm} className="text-on-surface-variant mt-xs">
              Checking clinical guidelines
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <MaterialIcon
              name="info"
              size={64}
              color={nutriSafeColors.onSurfaceVariant}
              filled
            />
            <Text
              style={typography.h3}
              className="text-on-surface mt-xl mb-sm font-bold"
            >
              No safe meals found
            </Text>
            <Text
              style={typography.bodyMd}
              className="text-on-surface-variant text-center px-lg"
            >
              Based on your clinical profile, none of these combinations are recommended. Try
              adding different ingredients.
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: nutriSafeColors.primary,
                borderRadius: radii.lg,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.xl,
                marginTop: spacing.lg,
              }}
            >
              <Text style={typography.bodyMd} className="text-on-primary font-semibold">
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {!loading &&
          results.map((meal, index) => (
            <View
              key={index}
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.lg,
                backgroundColor: nutriSafeColors.surfaceContainerLowest,
                borderRadius: radii.xl,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: nutriSafeColors.outlineVariant,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: spacing.md,
                }}
              >
                <Text style={typography.h3} className="text-on-surface flex-1 font-black leading-tight">
                  🍚 {meal.mealName}
                </Text>
                <View
                  style={{
                    backgroundColor: meal.verdict === "safe" ? `${nutriSafeColors.primaryContainer}20` : `${nutriSafeColors.tertiaryContainer}20`,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      ...typography.labelCaps,
                      color: meal.verdict === "safe" ? nutriSafeColors.onPrimaryContainer : nutriSafeColors.onTertiaryContainer,
                    }}
                  >
                    {meal.verdict === "safe" ? "✓ Suitable" : "⚠️ Caution"}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: nutriSafeColors.surfaceContainer,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <Text style={typography.labelCaps} className="text-on-surface-variant mb-sm">
                  Why?
                </Text>
                <Text
                  style={typography.bodyMd}
                  className="text-on-surface-variant leading-6"
                >
                  {meal.explanation.summary}
                </Text>
              </View>

              {meal.explanation.healthRisks?.length > 0 && (
                <View
                  style={{
                    backgroundColor: `${nutriSafeColors.tertiaryContainer}1a`,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                    borderWidth: 1,
                    borderColor: `${nutriSafeColors.tertiary}30`,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <MaterialIcon
                      name="warning"
                      size={20}
                      color={nutriSafeColors.onTertiaryContainer}
                    />
                    <Text style={typography.labelCaps} className="text-tertiary-container">
                      Things to note
                    </Text>
                  </View>
                  {meal.explanation.healthRisks.map((risk: string, i: number) => (
                    <Text key={i} style={typography.bodySm} className="text-on-surface-variant">
                      • {risk}
                    </Text>
                  ))}
                </View>
              )}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: nutriSafeColors.outlineVariant,
                  paddingTop: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text
                    style={typography.labelCaps}
                    className="text-on-surface-variant uppercase tracking-wide"
                  >
                    Nutrition
                  </Text>
                  <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                    {meal.nutrition.energyKcal.toFixed(0)} kcal •{" "}
                    {meal.nutrition.protein.toFixed(1)}g Protein
                  </Text>
                  <Text
                    style={typography.bodySm}
                    className="text-on-surface-variant mt-xs italic"
                  >
                    *Based on standard 100g servings per ingredient
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: `${nutriSafeColors.primary}1a`,
                    borderRadius: radii.lg,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <Text style={typography.bodyMd} className="text-primary font-semibold">
                    View meal →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}
