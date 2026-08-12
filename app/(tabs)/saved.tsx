import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  nutriSafeColors,
  radii,
  spacing,
  typography,
} from "@/components/NutriSafeTheme";

type Analysis = {
  _id: Id<"foodAnalyses">;
  foodName: string;
  verdict?: string;
  createdAt: number;
  status: string;
};

const verdictConfig = (verdict?: string) => {
  switch (verdict) {
    case "safe":
      return {
        bg: `${nutriSafeColors.primary}15`,
        color: nutriSafeColors.primary,
        icon: "checkmark-circle" as const,
        label: "Safe",
      };
    case "moderation":
      return {
        bg: "#FFF3CD",
        color: "#856404",
        icon: "warning" as const,
        label: "Moderation",
      };
    case "avoid":
    case "not_recommended":
      return {
        bg: `${nutriSafeColors.error}15`,
        color: nutriSafeColors.error,
        icon: "close-circle" as const,
        label: "Avoid",
      };
    default:
      return {
        bg: `${nutriSafeColors.surfaceContainer}`,
        color: nutriSafeColors.onSurfaceVariant,
        icon: "time-outline" as const,
        label: "Pending",
      };
  }
};

export default function SavedScreen() {
  const history = useQuery(api.analysis.history.getHistory, {});
  const removeAnalysis = useMutation(api.analysis.delete.remove);

  const isLoading = history === undefined;

  const handleDelete = (id: Id<"foodAnalyses">, foodName: string) => {
    Alert.alert(
      "Remove Analysis",
      `Remove "${foodName}" from your history?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAnalysis({ id });
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const safeCount = history?.filter((a: Analysis) => a.verdict === "safe").length ?? 0;
  const moderationCount = history?.filter((a: Analysis) => a.verdict === "moderation").length ?? 0;
  const avoidCount = history?.filter((a: Analysis) =>
    a.verdict === "avoid" || a.verdict === "not_recommended"
  ).length ?? 0;

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
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{ ...typography.h2, color: nutriSafeColors.onSurface }}
          >
            Saved
          </Text>
          {!isLoading && (
            <Text
              style={{
                ...typography.bodySm,
                color: nutriSafeColors.onSurfaceVariant,
                marginTop: 2,
              }}
            >
              {history.length}{" "}
              {history.length === 1 ? "analysis" : "analyses"} saved
            </Text>
          )}
        </View>
        {!isLoading && history.length > 0 && (
          <View
            style={{
              backgroundColor: `${nutriSafeColors.primary}15`,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: nutriSafeColors.primary,
              }}
            >
              {history.length}
            </Text>
          </View>
        )}
      </View>

      {/* ─── Loading ─── */}
      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={nutriSafeColors.primary} />
        </View>
      ) : history.length === 0 ? (
        // ─── Empty State ───
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radii.full,
              backgroundColor: `${nutriSafeColors.primary}15`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="bookmark"
              size={40}
              color={nutriSafeColors.primary}
            />
          </View>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Text
              style={{
                ...typography.h3,
                color: nutriSafeColors.onSurface,
                textAlign: "center",
              }}
            >
              No saved analyses
            </Text>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurfaceVariant,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Analyze a food to see your medical{"\n"}compatibility history here
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/search")}
            style={{
              backgroundColor: nutriSafeColors.primary,
              borderRadius: radii.xl,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md + 4,
            }}
          >
            <Text
              style={{
                ...typography.bodyMd,
                color: "#ffffff",
                fontWeight: "700",
              }}
            >
              Search Foods
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ─── Analysis List ───
        <FlatList
          data={history as Analysis[]}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            // ─── Summary stats ───
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                marginBottom: spacing.md,
              }}
            >
              {[
                {
                  count: safeCount,
                  ...verdictConfig("safe"),
                },
                {
                  count: moderationCount,
                  ...verdictConfig("moderation"),
                },
                {
                  count: avoidCount,
                  ...verdictConfig("avoid"),
                },
              ].map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: item.bg,
                    borderRadius: radii.xl,
                    padding: spacing.md,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={item.color} />
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: item.color,
                    }}
                  >
                    {item.count}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: item.color,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          }
          renderItem={({ item }: { item: Analysis }) => {
            const vc = verdictConfig(item.verdict);
            return (
              <TouchableOpacity
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
                }}
                activeOpacity={0.8}
              >
                {/* Verdict icon */}
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radii.lg,
                    backgroundColor: vc.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={vc.icon} size={26} color={vc.color} />
                </View>

                {/* Food info */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.bodyMd,
                      color: nutriSafeColors.onSurface,
                      fontWeight: "600",
                    }}
                    numberOfLines={1}
                  >
                    {item.foodName}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: vc.bg,
                        borderRadius: radii.full,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
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
                        {vc.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        ...typography.bodySm,
                        color: nutriSafeColors.onSurfaceVariant,
                      }}
                    >
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Delete */}
                <TouchableOpacity
                  onPress={() => handleDelete(item._id, item.foodName)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.full,
                    backgroundColor: `${nutriSafeColors.error}10`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={nutriSafeColors.error}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
