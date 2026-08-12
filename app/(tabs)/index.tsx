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
  FlatList,
} from "react-native";
import { useQuery, useAction } from "convex/react";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
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

// ─── Featured Food Card ────────────────────────────────────────────────────
function FeaturedFoodCard({
  item,
  onPress,
}: {
  item: FoodSearchResult;
  onPress: () => void;
}) {
  const categoryColors: Record<string, string> = {
    Cereals: "#FF6B6B",
    Vegetables: "#4ECDC4",
    Fruits: "#FFE66D",
    Dairy: "#A8E6CF",
    Meat: "#FF8B94",
    Fish: "#88D8B0",
    Pulses: "#FFAAA5",
    Oils: "#FFD93D",
  };

  const bg =
    categoryColors[item.category ?? ""] ?? nutriSafeColors.primaryContainer;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 200,
        height: 240,
        borderRadius: radii.xl,
        backgroundColor: bg,
        marginRight: spacing.md,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }}
      activeOpacity={0.85}
    >
      {/* Gradient overlay */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "55%",
          backgroundColor: "rgba(0,0,0,0.35)",
          borderBottomLeftRadius: radii.xl,
          borderBottomRightRadius: radii.xl,
        }}
      />
      {/* Category badge */}
      <View
        style={{
          position: "absolute",
          top: spacing.sm,
          right: spacing.sm,
          backgroundColor: "rgba(255,255,255,0.9)",
          borderRadius: radii.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        }}
      >
        <Text
          style={{ fontSize: 11, fontWeight: "700", color: nutriSafeColors.onSurface }}
        >
          {item.category ?? "Food"}
        </Text>
      </View>
      {/* Food icon */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: spacing.xl,
        }}
      >
        <MaterialIcons
          name="restaurant"
          size={64}
          color="rgba(255,255,255,0.85)"
        />
      </View>
      {/* Name + analyze prompt */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.md,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...typography.h3,
            color: "#ffffff",
            marginBottom: 2,
          }}
        >
          {item.name}
        </Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
          Tap to analyze →
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Recommended Food Card ─────────────────────────────────────────────────
function RecommendedFoodCard({
  item,
  onPress,
}: {
  item: FoodSearchResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: nutriSafeColors.surfaceContainerLowest,
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
      }}
      activeOpacity={0.8}
    >
      {/* Icon */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.lg,
          backgroundColor: `${nutriSafeColors.primary}15`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons
          name="restaurant"
          size={26}
          color={nutriSafeColors.primary}
        />
      </View>
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
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: nutriSafeColors.primary,
            textTransform: "uppercase",
          }}
        >
          Analyze
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Analysis Result Card ──────────────────────────────────────────────────
function AnalysisResultCard({
  result,
  onClose,
}: {
  result: any;
  onClose: () => void;
}) {
  const verdictConfig = {
    safe: {
      bg: `${nutriSafeColors.primary}15`,
      color: nutriSafeColors.primary,
      label: "SAFE",
      icon: "checkmark-circle" as const,
    },
    moderation: {
      bg: "#FFF3CD",
      color: "#856404",
      label: "MODERATION",
      icon: "warning" as const,
    },
    avoid: {
      bg: `${nutriSafeColors.error}15`,
      color: nutriSafeColors.error,
      label: "AVOID",
      icon: "close-circle" as const,
    },
  };

  const vc =
    verdictConfig[result.verdict as keyof typeof verdictConfig] ??
    verdictConfig.safe;

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        backgroundColor: nutriSafeColors.surfaceContainerLowest,
        borderRadius: radii.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: nutriSafeColors.outlineVariant,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Verdict badge */}
      <View
        style={{
          alignSelf: "flex-start",
          backgroundColor: vc.bg,
          borderRadius: radii.full,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: spacing.md,
        }}
      >
        <Ionicons name={vc.icon} size={16} color={vc.color} />
        <Text
          style={{ fontSize: 12, fontWeight: "700", color: vc.color }}
        >
          {vc.label}
        </Text>
      </View>

      {result.explanation && (
        <>
          <Text
            style={{
              ...typography.h3,
              color: nutriSafeColors.onSurface,
              marginBottom: spacing.sm,
            }}
          >
            {result.explanation.summary}
          </Text>

          <View
            style={{
              backgroundColor: nutriSafeColors.surfaceContainer,
              borderRadius: radii.lg,
              padding: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: nutriSafeColors.onSurfaceVariant,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Why?
            </Text>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                lineHeight: 22,
              }}
            >
              {result.explanation.why}
            </Text>
          </View>

          {result.explanation.healthRisks?.length > 0 && (
            <View
              style={{
                backgroundColor: `${nutriSafeColors.error}10`,
                borderRadius: radii.lg,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: nutriSafeColors.error,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Health Risks
              </Text>
              {result.explanation.healthRisks.map(
                (risk: string, i: number) => (
                  <Text
                    key={i}
                    style={{
                      ...typography.bodySm,
                      color: nutriSafeColors.onSurface,
                      marginBottom: 4,
                    }}
                  >
                    • {risk}
                  </Text>
                )
              )}
            </View>
          )}

          {result.explanation.alternatives?.length > 0 && (
            <View
              style={{
                backgroundColor: `${nutriSafeColors.primary}10`,
                borderRadius: radii.lg,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: nutriSafeColors.primary,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Safe Alternatives
              </Text>
              {result.explanation.alternatives.map(
                (alt: string, i: number) => (
                  <Text
                    key={i}
                    style={{
                      ...typography.bodyMd,
                      color: nutriSafeColors.onSurface,
                      fontWeight: "500",
                      marginBottom: 4,
                    }}
                  >
                    ✓ {alt}
                  </Text>
                )
              )}
            </View>
          )}
        </>
      )}

      <TouchableOpacity
        onPress={onClose}
        style={{
          borderRadius: radii.xl,
          paddingVertical: spacing.md,
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: nutriSafeColors.outlineVariant,
          marginTop: spacing.sm,
        }}
      >
        <Text
          style={{
            ...typography.bodyMd,
            color: nutriSafeColors.onSurfaceVariant,
            fontWeight: "600",
          }}
        >
          Analyze Another Food
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const profile = useQuery(api.profile.get.get);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick search for "featured" foods - show first 10
  const allFoods = useQuery(
    api.nutrition.search.search,
    { foodName: "rice" }
  );

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
    setSearchQuery("");
    try {
      const res = await analyzeFood({ foodId: food._id });
      setResult(res);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const firstName =
    (profile as any)?.name?.split(" ")[0] ?? "there";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  // Featured = first 5 foods; Recommended = next set
  const featuredFoods = allFoods?.slice(0, 5) ?? [];
  const recommendedFoods = allFoods?.slice(5, 15) ?? [];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ─── Header ─── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                ...typography.bodySm,
                color: nutriSafeColors.onSurfaceVariant,
              }}
            >
              {greeting()} 👋
            </Text>
            <Text
              style={{
                ...typography.h2,
                color: nutriSafeColors.onSurface,
              }}
            >
              {firstName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile")}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.full,
              backgroundColor: `${nutriSafeColors.primary}15`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="person"
              size={22}
              color={nutriSafeColors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* ─── Search Bar (taps to Search tab) ─── */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/search")}
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            gap: spacing.sm,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="search"
            size={20}
            color={nutriSafeColors.onSurfaceVariant}
          />
          <Text
            style={{
              ...typography.bodyMd,
              color: nutriSafeColors.onSurfaceVariant,
              flex: 1,
            }}
          >
            Search foods, check safety...
          </Text>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.lg,
              backgroundColor: nutriSafeColors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="options" size={18} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* ─── Quick Analysis Search ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: radii.xl,
              paddingHorizontal: spacing.md,
              paddingVertical: Platform.OS === "ios" ? spacing.sm : 2,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              borderWidth: 1.5,
              borderColor: searchQuery.length > 0 ? nutriSafeColors.primary : nutriSafeColors.outlineVariant,
            }}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={
                searchQuery.length > 0
                  ? nutriSafeColors.primary
                  : nutriSafeColors.onSurfaceVariant
              }
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Analyze a food now…"
              placeholderTextColor={nutriSafeColors.onSurfaceVariant}
              style={{
                flex: 1,
                color: nutriSafeColors.onSurface,
                fontSize: 15,
                paddingVertical: spacing.sm,
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={nutriSafeColors.onSurfaceVariant}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Search Results Dropdown ─── */}
        {searchQuery.length > 2 && searchResults && !analyzing && !result && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              backgroundColor: "#ffffff",
              borderRadius: radii.xl,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            {searchResults.length === 0 ? (
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.onSurfaceVariant,
                  textAlign: "center",
                  padding: spacing.lg,
                }}
              >
                No foods found
              </Text>
            ) : (
              searchResults.map((food: FoodSearchResult, idx: number) => (
                <TouchableOpacity
                  key={food._id}
                  onPress={() => handleAnalyze(food)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    borderBottomWidth:
                      idx < searchResults.length - 1 ? 1 : 0,
                    borderBottomColor: nutriSafeColors.outlineVariant,
                    gap: spacing.md,
                  }}
                >
                  <MaterialIcons
                    name="restaurant"
                    size={20}
                    color={nutriSafeColors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.bodyMd,
                        color: nutriSafeColors.onSurface,
                        fontWeight: "600",
                      }}
                    >
                      {food.name}
                    </Text>
                    {food.category && (
                      <Text
                        style={{
                          ...typography.bodySm,
                          color: nutriSafeColors.onSurfaceVariant,
                        }}
                      >
                        {food.category}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      backgroundColor: `${nutriSafeColors.primary}15`,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: nutriSafeColors.primary,
                        textTransform: "uppercase",
                      }}
                    >
                      Analyze
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ─── Loading ─── */}
        {analyzing && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.lg,
              backgroundColor: "#ffffff",
              borderRadius: radii.xl,
              padding: spacing.xl,
              alignItems: "center",
              gap: spacing.md,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <ActivityIndicator size="large" color={nutriSafeColors.primary} />
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
              }}
            >
              Running Medical Rules Engine...
            </Text>
            <Text
              style={{
                ...typography.bodySm,
                color: nutriSafeColors.onSurfaceVariant,
              }}
            >
              Evaluating alternatives...
            </Text>
          </View>
        )}

        {/* ─── Analysis Result ─── */}
        {result && !analyzing && (
          <AnalysisResultCard result={result} onClose={() => setResult(null)} />
        )}

        {/* ─── Featured Section ─── */}
        {!analyzing && !result && (
          <>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  ...typography.h3,
                  color: nutriSafeColors.onSurface,
                }}
              >
                Featured Foods
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/search")}>
                <Text
                  style={{
                    ...typography.bodySm,
                    color: nutriSafeColors.primary,
                    fontWeight: "600",
                  }}
                >
                  See all
                </Text>
              </TouchableOpacity>
            </View>

            {featuredFoods.length === 0 ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.lg,
                  height: 240,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator
                  size="large"
                  color={nutriSafeColors.primary}
                />
              </View>
            ) : (
              <FlatList
                data={featuredFoods}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.sm,
                }}
                renderItem={({ item }) => (
                  <FeaturedFoodCard
                    item={item}
                    onPress={() => handleAnalyze(item)}
                  />
                )}
                style={{ marginBottom: spacing.lg }}
              />
            )}

            {/* ─── Recommended Section ─── */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.md,
              }}
            >
              <Text
                style={{
                  ...typography.h3,
                  color: nutriSafeColors.onSurface,
                  marginBottom: spacing.md,
                }}
              >
                Recommended for You
              </Text>

              {recommendedFoods.length === 0 ? (
                <View
                  style={{ alignItems: "center", padding: spacing.lg }}
                >
                  <ActivityIndicator
                    size="small"
                    color={nutriSafeColors.primary}
                  />
                </View>
              ) : (
                recommendedFoods.map((food: FoodSearchResult) => (
                  <RecommendedFoodCard
                    key={food._id}
                    item={food}
                    onPress={() => handleAnalyze(food)}
                  />
                ))
              )}
            </View>

            {/* ─── Quick Action Cards ─── */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
                gap: spacing.sm,
              }}
            >
              <Text
                style={{
                  ...typography.h3,
                  color: nutriSafeColors.onSurface,
                  marginBottom: spacing.xs,
                }}
              >
                Quick Actions
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/create")}
                style={{
                  backgroundColor: nutriSafeColors.primary,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
                activeOpacity={0.85}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.lg,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="camera" size={24} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.bodyMd,
                      color: "#ffffff",
                      fontWeight: "700",
                    }}
                  >
                    Scan Food
                  </Text>
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    Identify and analyze any food
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/meal-planner")}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
                activeOpacity={0.85}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.lg,
                    backgroundColor: `${nutriSafeColors.primary}15`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name="restaurant-menu"
                    size={24}
                    color={nutriSafeColors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.bodyMd,
                      color: nutriSafeColors.onSurface,
                      fontWeight: "700",
                    }}
                  >
                    Meal Planner
                  </Text>
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: nutriSafeColors.onSurfaceVariant,
                    }}
                  >
                    Build safe meals from ingredients
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={nutriSafeColors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
