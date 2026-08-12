import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useQuery, useAction } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  nutriSafeColors,
  radii,
  spacing,
  typography,
} from "@/components/NutriSafeTheme";

type FoodSearchResult = {
  _id: Id<"foods">;
  name: string;
  category?: string;
};

const CATEGORIES = [
  "All",
  "Cereals",
  "Vegetables",
  "Fruits",
  "Dairy",
  "Meat",
  "Fish",
  "Pulses",
  "Oils",
  "Spices",
  "Nuts",
];

const DEFAULT_QUERIES = ["rice", "wheat", "dal", "vegetable", "fruit"];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ openFilters?: string }>();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const analyzeFood = useAction(api.analysis.analyze.analyze);

  useEffect(() => {
    if (params.openFilters === "true") setShowFilters(true);
  }, [params.openFilters]);

  // Use a meaningful default query to show results
  const queryTerm =
    search.length > 1
      ? search
      : activeCategory !== "All"
      ? activeCategory.toLowerCase()
      : "rice";

  const results = useQuery(api.nutrition.search.search, {
    foodName: queryTerm,
  });

  const filteredResults =
    results?.filter((item: FoodSearchResult) => {
      if (activeCategory === "All") return true;
      return (
        item.category?.toLowerCase() === activeCategory.toLowerCase()
      );
    }) ?? [];

  const handleAnalyze = async (food: FoodSearchResult) => {
    setAnalyzingId(food._id);
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await analyzeFood({ foodId: food._id });
      setAnalysisResult({ food, result: res });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAnalyzing(false);
      setAnalyzingId(null);
    }
  };

  const verdictConfig = (verdict: string) => {
    switch (verdict) {
      case "safe":
        return { bg: `${nutriSafeColors.primary}15`, color: nutriSafeColors.primary, icon: "checkmark-circle" as const };
      case "moderation":
        return { bg: "#FFF3CD", color: "#856404", icon: "warning" as const };
      default:
        return { bg: `${nutriSafeColors.error}15`, color: nutriSafeColors.error, icon: "close-circle" as const };
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
      edges={["top"]}
    >
      {/* ─── Header ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <Text
          style={{ ...typography.h2, color: nutriSafeColors.onSurface }}
        >
          Find Food
        </Text>
        <Text
          style={{
            ...typography.bodySm,
            color: nutriSafeColors.onSurfaceVariant,
            marginTop: 2,
          }}
        >
          Search and analyze nutritional safety
        </Text>
      </View>

      {/* ─── Search Bar + Filter Button ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            paddingHorizontal: spacing.md,
            paddingVertical: Platform.OS === "ios" ? spacing.sm : 2,
            gap: spacing.sm,
            borderWidth: 1.5,
            borderColor:
              search.length > 0
                ? nutriSafeColors.primary
                : nutriSafeColors.outlineVariant,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Ionicons
            name="search"
            size={18}
            color={
              search.length > 0
                ? nutriSafeColors.primary
                : nutriSafeColors.onSurfaceVariant
            }
          />
          <TextInput
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setAnalysisResult(null);
            }}
            placeholder="Search foods, ingredients..."
            placeholderTextColor={nutriSafeColors.onSurfaceVariant}
            style={{
              flex: 1,
              color: nutriSafeColors.onSurface,
              fontSize: 15,
              paddingVertical: spacing.sm,
            }}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={nutriSafeColors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter button */}
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={{
            width: 50,
            height: 50,
            borderRadius: radii.xl,
            backgroundColor:
              activeCategory !== "All"
                ? nutriSafeColors.primary
                : "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
            borderWidth: 1.5,
            borderColor:
              activeCategory !== "All"
                ? nutriSafeColors.primary
                : nutriSafeColors.outlineVariant,
          }}
        >
          <Ionicons
            name="options"
            size={20}
            color={
              activeCategory !== "All"
                ? "#ffffff"
                : nutriSafeColors.onSurface
            }
          />
          {activeCategory !== "All" && (
            <View
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: nutriSafeColors.error,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>
                1
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Active Category Chips ─── */}
      {activeCategory !== "All" && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            flexDirection: "row",
            gap: spacing.xs,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: `${nutriSafeColors.primary}15`,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              gap: 6,
            }}
          >
            <Text
              style={{
                ...typography.bodySm,
                color: nutriSafeColors.primary,
                fontWeight: "600",
              }}
            >
              {activeCategory}
            </Text>
            <TouchableOpacity onPress={() => setActiveCategory("All")}>
              <Ionicons
                name="close"
                size={14}
                color={nutriSafeColors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Category Filter Drawer ─── */}
      {showFilters && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.sm,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setActiveCategory(cat);
                  setShowFilters(false);
                  setAnalysisResult(null);
                }}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                  borderRadius: radii.full,
                  backgroundColor:
                    activeCategory === cat
                      ? nutriSafeColors.primary
                      : "#ffffff",
                  borderWidth: 1.5,
                  borderColor:
                    activeCategory === cat
                      ? nutriSafeColors.primary
                      : nutriSafeColors.outlineVariant,
                }}
              >
                <Text
                  style={{
                    ...typography.bodySm,
                    color:
                      activeCategory === cat
                        ? "#ffffff"
                        : nutriSafeColors.onSurface,
                    fontWeight: "600",
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── Category Scroll (always visible) ─── */}
      {!showFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            paddingVertical: 4,
            marginBottom: spacing.sm,
          }}
          style={{ maxHeight: 52, marginBottom: spacing.sm }}
        >
          {CATEGORIES.slice(0, 7).map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => {
                setActiveCategory(cat);
                setAnalysisResult(null);
              }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                backgroundColor:
                  activeCategory === cat
                    ? nutriSafeColors.primary
                    : "#ffffff",
                borderWidth: 1.5,
                borderColor:
                  activeCategory === cat
                    ? nutriSafeColors.primary
                    : nutriSafeColors.outlineVariant,
              }}
            >
              <Text
                style={{
                  ...typography.bodySm,
                  color:
                    activeCategory === cat
                      ? "#ffffff"
                      : nutriSafeColors.onSurface,
                  fontWeight: "600",
                }}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ─── Analysis Result Panel ─── */}
      {analysisResult && !analyzing && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            padding: spacing.lg,
            borderWidth: 1.5,
            borderColor: (() => {
              const vc = verdictConfig(analysisResult.result.verdict);
              return vc.color;
            })(),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {(() => {
            const vc = verdictConfig(analysisResult.result.verdict);
            return (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Ionicons name={vc.icon} size={22} color={vc.color} />
                    <View>
                      <Text
                        style={{
                          ...typography.h3,
                          color: nutriSafeColors.onSurface,
                        }}
                      >
                        {analysisResult.food.name}
                      </Text>
                      <View
                        style={{
                          backgroundColor: vc.bg,
                          borderRadius: radii.full,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          alignSelf: "flex-start",
                          marginTop: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: vc.color,
                            textTransform: "uppercase",
                          }}
                        >
                          {analysisResult.result.verdict}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setAnalysisResult(null)}>
                    <Ionicons
                      name="close"
                      size={20}
                      color={nutriSafeColors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>
                {analysisResult.result.explanation?.summary && (
                  <Text
                    style={{
                      ...typography.bodyMd,
                      color: nutriSafeColors.onSurface,
                    }}
                    numberOfLines={3}
                  >
                    {analysisResult.result.explanation.summary}
                  </Text>
                )}
              </>
            );
          })()}
        </View>
      )}

      {/* ─── Results Count ─── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        <Text
          style={{
            ...typography.bodySm,
            color: nutriSafeColors.onSurfaceVariant,
          }}
        >
          {results === undefined
            ? "Searching..."
            : `${filteredResults.length} foods found`}
        </Text>
      </View>

      {/* ─── Results List ─── */}
      {results === undefined ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={nutriSafeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: FoodSearchResult }) => (
            <TouchableOpacity
              onPress={() => handleAnalyze(item)}
              disabled={analyzingId === item._id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: radii.xl,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginBottom: spacing.sm,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
                opacity: analyzingId === item._id ? 0.6 : 1,
              }}
              activeOpacity={0.8}
            >
              {/* Icon */}
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radii.lg,
                  backgroundColor: `${nutriSafeColors.primary}12`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {analyzingId === item._id ? (
                  <ActivityIndicator
                    size="small"
                    color={nutriSafeColors.primary}
                  />
                ) : (
                  <MaterialIcons
                    name="restaurant"
                    size={26}
                    color={nutriSafeColors.primary}
                  />
                )}
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.bodyMd,
                    color: nutriSafeColors.onSurface,
                    fontWeight: "600",
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.category && (
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: nutriSafeColors.onSurfaceVariant,
                      marginTop: 2,
                    }}
                  >
                    {item.category}
                  </Text>
                )}
              </View>

              {/* Analyze chip */}
              <View
                style={{
                  backgroundColor: `${nutriSafeColors.primary}15`,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: nutriSafeColors.primary,
                  }}
                >
                  Analyze
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={nutriSafeColors.primary}
                />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                paddingTop: spacing.xxl,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: radii.full,
                  backgroundColor: `${nutriSafeColors.primary}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="search"
                  size={32}
                  color={nutriSafeColors.primary}
                />
              </View>
              <Text
                style={{
                  ...typography.h3,
                  color: nutriSafeColors.onSurface,
                  textAlign: "center",
                }}
              >
                No foods found
              </Text>
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Try a different search or{"\n"}change the category filter
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
