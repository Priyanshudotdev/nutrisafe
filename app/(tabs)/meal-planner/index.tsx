import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { MaterialIcon } from "@/components/NutriSafeComponents";

type FoodSearchResult = {
  _id: Id<"foods">;
  name: string;
  category?: string;
};

export default function MealPlannerIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<{ id: Id<"foods">; name: string }[]>([]);

  const searchResults = useQuery(
    api.nutrition.search.search,
    searchQuery.length > 2 ? { foodName: searchQuery } : "skip"
  );

  const toggleFood = (food: FoodSearchResult) => {
    if (selectedFoods.find((f) => f.id === food._id)) {
      setSelectedFoods(selectedFoods.filter((f) => f.id !== food._id));
    } else {
      setSelectedFoods([...selectedFoods, { id: food._id, name: food.name }]);
    }
  };

  const handleFindMeals = () => {
    if (selectedFoods.length === 0) {
      Alert.alert("Select ingredients", "Please select at least one ingredient.");
      return;
    }
    const ids = selectedFoods.map((f) => f.id).join(",");
    router.push(`/meal-planner/results?foodIds=${ids}`);
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
              <MaterialIcon name="arrow_back" size={24} color={nutriSafeColors.onPrimary} />
            </TouchableOpacity>
            <Text style={typography.h2} className="text-on-primary">
              Meal Planner
            </Text>
          </View>
          <Text style={typography.bodyMd} className="text-on-primary opacity-90">
            Build safe meals from what you have
          </Text>
        </View>

        {/* Instructions */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: nutriSafeColors.secondaryContainer,
              borderRadius: radii.xl,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                backgroundColor: `${nutriSafeColors.onSecondaryContainer}1a`,
                borderRadius: radii.full,
                padding: spacing.sm,
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <MaterialIcon
                name="restaurant_menu"
                size={24}
                color={nutriSafeColors.onSecondaryContainer}
                filled
              />
            </View>
            <Text style={typography.h3} className="text-on-secondary-container mb-sm font-semibold">
              How it works
            </Text>
            <Text style={typography.bodyMd} className="text-on-secondary-container opacity-90 mb-sm">
              1. Select the ingredients you have
            </Text>
            <Text style={typography.bodyMd} className="text-on-secondary-container opacity-90">
              2. We will build safe meals for your profile
            </Text>
          </View>
        </View>

        {/* Selected Ingredients */}
        {selectedFoods.length > 0 && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.md,
            }}
          >
            <Text style={typography.labelCaps} className="text-on-surface-variant mb-sm">
              Selected Ingredients
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {selectedFoods.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={{
                    backgroundColor: nutriSafeColors.primary,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  }}
                  onPress={() =>
                    setSelectedFoods((items) => items.filter((item) => item.id !== food.id))
                  }
                >
                  <Text style={typography.bodySm} className="text-on-primary">
                    {food.name} ×
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Search */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
          }}
        >
          <Text style={typography.h3} className="text-on-surface mb-md">
            Search Ingredients
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
              placeholder="Search for ingredients (e.g. Rice, Dal)"
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
                <MaterialIcon name="close" size={20} color={nutriSafeColors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results */}
        {searchQuery.length > 2 && searchResults && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            {searchResults.length === 0 ? (
              <Text style={typography.bodyMd} className="text-on-surface-variant text-center py-lg">
                No ingredients found.
              </Text>
            ) : (
              searchResults.map((food: FoodSearchResult) => {
                const isSelected = selectedFoods.find((f) => f.id === food._id);
                return (
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
                    onPress={() => toggleFood(food)}
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
                        backgroundColor: isSelected
                          ? nutriSafeColors.primary
                          : nutriSafeColors.outlineVariant,
                        borderRadius: radii.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.labelCaps,
                          color: isSelected
                            ? nutriSafeColors.onPrimary
                            : nutriSafeColors.onSurfaceVariant,
                        }}
                      >
                        {isSelected ? "Selected" : "Add"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Build Button */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={handleFindMeals}
            style={{
              backgroundColor:
                selectedFoods.length > 0
                  ? nutriSafeColors.primary
                  : nutriSafeColors.secondaryFixedDim,
              borderRadius: radii.lg,
              paddingVertical: spacing.lg,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: selectedFoods.length > 0 ? 0.3 : 0,
              shadowRadius: 4,
              elevation: selectedFoods.length > 0 ? 2 : 0,
            }}
          >
            <Text
              style={{
                ...typography.bodyMd,
                color:
                  selectedFoods.length > 0
                    ? nutriSafeColors.onPrimary
                    : nutriSafeColors.onSecondaryFixedVariant,
                fontWeight: "600",
              }}
            >
              Build Safe Meals
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
