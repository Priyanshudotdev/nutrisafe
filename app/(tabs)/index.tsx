import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Conditionally run the query only if search term is long enough
  const searchResults = useQuery(
    api.nutrition.search.search, 
    searchQuery.length > 2 ? { foodName: searchQuery } : "skip"
  );

  const analyzeFood = useAction(api.analysis.analyze.analyze);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (food: any) => {
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await analyzeFood({ foodId: food._id });
      setResult(res);
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setAnalyzing(false);
      setSearchQuery(""); // Hide dropdown
    }
  };

  return (
    <View className="flex-1 bg-background p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-extrabold text-foreground mb-1 mt-4">
          NutriSafe Analysis
        </Text>
        <Text className="text-default-500 mb-6">
          Find out if a food fits your medical profile.
        </Text>
        
        <TextInput className="border border-default-200 rounded-xl p-4 bg-default-50 text-foreground mt-1 mb-3" placeholderTextColor="#888"
          placeholder="Search for foods (e.g. Banana, Wheat)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="shadow-sm p-3 text-lg"
        />

        {searchQuery.length > 2 && searchResults && !analyzing && !result && (
          <View className="bg-content1 rounded-xl mt-2 p-2 shadow-lg border border-default-200">
            {searchResults.length === 0 ? (
              <Text className="p-3 text-default-500 text-center">No foods found.</Text>
            ) : (
              searchResults.map(food => (
                <TouchableOpacity 
                  key={food._id}
                  className="p-3 border-b border-default-100 last:border-b-0 flex flex-row items-center justify-between"
                  onPress={() => handleAnalyze(food)}
                >
                  <View>
                    <Text className="font-semibold text-foreground text-lg">{food.name}</Text>
                    {food.category && <Text className="text-xs text-default-400">{food.category}</Text>}
                  </View>
                  <View className="bg-primary/10 px-3 py-1 rounded-full">
                    <Text className="text-primary text-xs font-bold">Analyze</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {analyzing && (
          <View className="mt-12 items-center justify-center p-8 bg-content1 rounded-2xl shadow-sm border border-default-100">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="mt-4 text-default-600 font-medium">Running Medical Rules Engine...</Text>
            <Text className="text-default-400 text-xs mt-1">Evaluating alternatives...</Text>
          </View>
        )}

        {result && (
          <View className="mt-6 bg-content1 rounded-2xl p-5 shadow-lg border border-default-200">
            {/* Verdict Badge */}
            <View className={`px-4 py-2 rounded-full self-start mb-4 ${
              result.verdict === 'safe' ? 'bg-success/20' : 
              result.verdict === 'moderation' ? 'bg-warning/20' : 'bg-danger/20'
            }`}>
              <Text className={`font-black tracking-wide ${
                result.verdict === 'safe' ? 'text-success-700' : 
                result.verdict === 'moderation' ? 'text-warning-700' : 'text-danger-700'
              }`}>
                {result.verdict.toUpperCase()}
              </Text>
            </View>

            {result.explanation ? (
              <View className="flex flex-col gap-4">
                <Text className="text-xl font-bold text-foreground">
                  {result.explanation.summary}
                </Text>
                
                <View className="bg-default-100 p-4 rounded-xl">
                  <Text className="font-bold text-foreground mb-1">Why?</Text>
                  <Text className="text-default-600 leading-5">
                    {result.explanation.why}
                  </Text>
                </View>

                {result.explanation.healthRisks?.length > 0 && (
                  <View className="bg-danger/10 p-4 rounded-xl">
                    <Text className="font-bold text-danger-600 mb-2">Specific Risks</Text>
                    {result.explanation.healthRisks.map((risk: string, i: number) => (
                      <Text key={i} className="text-danger-700 mb-1">• {risk}</Text>
                    ))}
                  </View>
                )}

                {result.explanation.portionAdvice && (
                  <View className="bg-warning/10 p-4 rounded-xl">
                    <Text className="font-bold text-warning-700 mb-1">Portion Advice</Text>
                    <Text className="text-warning-800">{result.explanation.portionAdvice}</Text>
                  </View>
                )}

                {result.explanation.alternatives?.length > 0 && (
                  <View className="bg-primary/10 p-4 rounded-xl">
                    <Text className="font-bold text-primary-700 mb-2">Medically Safe Alternatives</Text>
                    {result.explanation.alternatives.map((alt: string, i: number) => (
                      <Text key={i} className="text-primary-800 font-medium mb-1">✓ {alt}</Text>
                    ))}
                  </View>
                )}
                
                <Text className="text-xs text-default-400 mt-2 text-center italic px-4">
                  {result.explanation.disclaimer}
                </Text>
              </View>
            ) : (
              <Text className="text-danger mt-2">Analysis completed, but AI explanation failed to generate.</Text>
            )}
            
            <TouchableOpacity className="mt-8 shadow-sm bg-default-200 items-center justify-center p-4 rounded-xl" 
              onPress={() => setResult(null)}
            >
              <Text className="text-default-700 font-bold">Analyze Another Food</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
