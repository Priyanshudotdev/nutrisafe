import React, { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator , TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MealPlannerResults() {
  const { foodIds } = useLocalSearchParams();
  const router = useRouter();
  const generateMeals = useAction(api.meals.recommend.generate);
  
  const [loading, setLoading] = React.useState(true);
  const [results, setResults] = React.useState<any[]>([]);

  useEffect(() => {
    if (!foodIds) return;
    const fetchMeals = async () => {
      try {
        const idsArray = (foodIds as string).split(",");
        const res = await generateMeals({ foodIds: idsArray as any });
        setResults(res);
      } catch (e: any) {
        console.error(e);
        alert(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, [foodIds, generateMeals]);

  return (
    <View className="flex-1 bg-background p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-extrabold text-foreground mb-1 mt-4">
          Here&apos;s what you can eat
        </Text>
        <Text className="text-default-500 mb-6">
          Medically verified meal combinations.
        </Text>
        
        {loading && (
          <View className="mt-12 items-center justify-center p-8 bg-content1 rounded-2xl shadow-sm border border-default-100">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="mt-4 text-default-600 font-medium">Building meal combinations...</Text>
            <Text className="text-default-400 text-xs mt-1">Checking clinical guidelines...</Text>
          </View>
        )}

        {!loading && results.length === 0 && (
          <View className="mt-6 items-center bg-content1 rounded-2xl p-8 border border-default-200">
            <Text className="text-lg font-bold text-foreground">No safe meals found</Text>
            <Text className="text-default-500 text-center mt-2">
              Based on your clinical profile, none of these combinations are recommended. Try adding different ingredients.
            </Text>
            <TouchableOpacity className="mt-6 shadow-sm items-center justify-center p-4 rounded-xl" variant="flat" onPress={() => router.back()}>
              Go Back
            </TouchableOpacity>
          </View>
        )}

        {!loading && results.map((meal, index) => (
          <View key={index} className="bg-content1 rounded-2xl p-5 mb-5 shadow-lg border border-default-200">
            <View className="flex flex-row items-start justify-between mb-3">
              <Text className="text-xl font-black text-foreground flex-1 leading-tight">
                🍚 {meal.mealName}
              </Text>
              <View className={`px-3 py-1 rounded-full ${meal.verdict === 'safe' ? 'bg-success/20' : 'bg-warning/20'}`}>
                <Text className={`text-xs font-bold ${meal.verdict === 'safe' ? 'text-success-700' : 'text-warning-700'}`}>
                  ✓ Suitable
                </Text>
              </View>
            </View>

            <View className="bg-default-100 p-4 rounded-xl mb-3 mt-2">
              <Text className="font-bold text-default-800 mb-1">Why?</Text>
              <Text className="text-default-600 text-sm leading-5">{meal.explanation.summary}</Text>
            </View>

            {meal.explanation.healthRisks?.length > 0 && (
              <View className="mb-3 px-1">
                <Text className="font-bold text-warning-700 text-sm mb-1">Things to note</Text>
                {meal.explanation.healthRisks.map((risk: string, i: number) => (
                  <Text key={i} className="text-default-500 text-xs">• {risk}</Text>
                ))}
              </View>
            )}

            <View className="flex flex-row justify-between items-center border-t border-default-100 pt-4 mt-2">
              <View>
                <Text className="text-xs text-default-400 font-bold uppercase tracking-wide mb-1">Nutrition</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {meal.nutrition.energyKcal.toFixed(0)} kcal • {meal.nutrition.protein.toFixed(1)}g Protein
                </Text>
                <Text className="text-[10px] text-default-400 mt-1 italic">
                  *Based on standard 100g servings per ingredient
                </Text>
              </View>
              <TouchableOpacity size="sm" variant="flat" color="primary">
                View meal →
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
