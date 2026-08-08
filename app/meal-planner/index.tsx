import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";

export default function MealPlannerIndex() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<{id: string, name: string}[]>([]);
  
  const searchResults = useQuery(
    api.nutrition.search.search, 
    searchQuery.length > 2 ? { foodName: searchQuery } : "skip"
  );

  const toggleFood = (food: any) => {
    if (selectedFoods.find(f => f.id === food._id)) {
      setSelectedFoods(selectedFoods.filter(f => f.id !== food._id));
    } else {
      setSelectedFoods([...selectedFoods, { id: food._id, name: food.name }]);
    }
  };

  const handleFindMeals = () => {
    if (selectedFoods.length === 0) {
      Alert.alert("Select ingredients", "Please select at least one ingredient.");
      return;
    }
    const ids = selectedFoods.map(f => f.id).join(",");
    router.push(`/meal-planner/results?foodIds=${ids}`);
  };

  return (
    <View className="flex-1 bg-background p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-extrabold text-foreground mb-1 mt-4">
          What do you have?
        </Text>
        <Text className="text-default-500 mb-6">
          Select the ingredients you have available, and we&apos;ll build safe meals for your profile.
        </Text>
        
        {selectedFoods.length > 0 && (
          <View className="flex flex-row flex-wrap gap-2 mb-6 bg-content1 p-3 rounded-xl border border-default-200">
            <Text className="w-full font-bold text-default-600 text-sm mb-2">Selected Ingredients</Text>
            {selectedFoods.map(food => (
              <TouchableOpacity
                key={food.id}
                size="sm"
                className="bg-primary shadow-sm px-3 py-1"
                onPress={() => toggleFood(food.id, food.name)}
              >
                <Text className="text-white font-medium">{food.name} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput className="border border-default-200 rounded-xl p-4 bg-default-50 text-foreground mt-1 mb-3" placeholderTextColor="#888"
          placeholder="Search for ingredients (e.g. Rice, Dal)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="shadow-sm"
          size="lg"
        />

        {searchQuery.length > 2 && searchResults && (
          <View className="bg-content1 rounded-xl mt-2 p-2 shadow-lg border border-default-200">
            {searchResults.length === 0 ? (
              <Text className="p-3 text-default-500 text-center">No ingredients found.</Text>
            ) : (
              searchResults.map(food => {
                const isSelected = selectedFoods.find(f => f.id === food._id);
                return (
                  <TouchableOpacity 
                    key={food._id}
                    className="p-3 border-b border-default-100 last:border-b-0 flex flex-row items-center justify-between"
                    onPress={() => toggleFood(food._id, food.name)}
                  >
                    <View>
                      <Text className="font-semibold text-foreground text-lg">{food.name}</Text>
                      {food.category && <Text className="text-xs text-default-400">{food.category}</Text>}
                    </View>
                    <View className={`px-3 py-1 rounded-full ${isSelected ? "bg-primary" : "bg-default-200"}`}>
                      <Text className={`text-xs font-bold ${isSelected ? "text-white" : "text-default-600"}`}>
                        {isSelected ? "Selected" : "Add"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

      </ScrollView>
      <View className="pt-4 mb-4">
        <TouchableOpacity 
          className={selectedFoods.length > 0 ? "mt-8 bg-primary shadow-lg shadow-primary/30" : "mt-8 bg-default-300"}
          onPress={handleFindMeals}
          
        >
          <Text className={selectedFoods.length > 0 ? "text-white font-bold" : "text-default-500 font-bold"}>
            Build Safe Meals
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
