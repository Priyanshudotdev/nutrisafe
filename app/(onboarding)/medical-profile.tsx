import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Button } from "heroui-native/button";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Condition } from "@/convex/rules/types";

const AVAILABLE_CONDITIONS: { id: Condition; label: string }[] = [
  { id: "diabetes", label: "Diabetes" },
  { id: "ckd", label: "Chronic Kidney Disease" },
  { id: "heart_hypertension", label: "Heart Disease / Hypertension" },
  { id: "celiac", label: "Celiac Disease" },
];

export default function MedicalProfileScreen() {
  const router = useRouter();
  const createProfile = useMutation(api.profile.create.create);

  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<Condition[]>([]);
  const [allergiesText, setAllergiesText] = useState("");

  const toggleCondition = (condition: Condition) => {
    setSelectedConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition]
    );
  };

  const handleSave = async () => {
    if (!age || !gender || !height || !weight) {
      Alert.alert("Required Fields", "Please fill in your basic physical details.");
      return;
    }

    setLoading(true);
    try {
      const allergiesList = allergiesText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      // Enforce the architecture rule: if allergies exist, add food_allergy condition
      let finalConditions = [...selectedConditions];
      if (allergiesList.length > 0 && !finalConditions.includes("food_allergy")) {
        finalConditions.push("food_allergy");
      }

      await createProfile({
        name: "User", // Can be updated if needed or extracted from auth session
        age: parseInt(age) || 30,
        gender,
        height: parseInt(height) || 170,
        weight: parseInt(weight) || 70,
        conditions: finalConditions,
        allergies: allergiesList,
        dietaryPreferences: [],
      });

      // Route back to index to let the state machine push us to (tabs)
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error Saving Profile", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="bg-background flex-1">
      <ScrollView contentContainerClassName="p-6 pt-16 flex-grow">
        <Text className="text-foreground mb-2 text-3xl font-extrabold">Medical Profile</Text>
        <Text className="text-default-500 mb-8 text-lg">Personalizing your safety analysis</Text>

        <View className="flex flex-col gap-6">
          <View className="flex flex-row gap-4">
            <View className="flex-1">
              <Text className="text-foreground mb-1 font-bold">Age</Text>
              <TextInput
                className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 35"
              />
            </View>
            <View className="flex-1">
              <Text className="text-foreground mb-1 font-bold">Gender</Text>
              <TextInput
                className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
                placeholderTextColor="#888"
                value={gender}
                onChangeText={setGender}
                placeholder="e.g. Male"
              />
            </View>
          </View>

          <View className="flex flex-row gap-4">
            <View className="flex-1">
              <Text className="text-foreground mb-1 font-bold">Height (cm)</Text>
              <TextInput
                className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
                placeholder="e.g. 175"
              />
            </View>
            <View className="flex-1">
              <Text className="text-foreground mb-1 font-bold">Weight (kg)</Text>
              <TextInput
                className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 70"
              />
            </View>
          </View>

          <View className="mt-2">
            <Text className="text-foreground mb-3 text-lg font-bold">Health Conditions</Text>
            <View className="flex flex-row flex-wrap gap-2">
              {AVAILABLE_CONDITIONS.map((cond) => {
                const isSelected = selectedConditions.includes(cond.id);
                return (
                  <TouchableOpacity
                    key={cond.id}
                    onPress={() => toggleCondition(cond.id)}
                    className={
                      isSelected
                        ? "bg-primary shadow-primary/20 px-3 py-1 shadow-md"
                        : "bg-default-100 px-3 py-1"
                    }>
                    <Text className={isSelected ? "font-medium text-white" : "text-default-700"}>
                      {cond.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="mt-2">
            <Text className="text-foreground mb-3 text-lg font-bold">Food Allergies</Text>
            <Text className="text-foreground mb-1 font-bold">Allergies</Text>
            <TextInput
              className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
              placeholderTextColor="#888"
              placeholder="e.g. peanuts, milk, shellfish (comma separated)"
              value={allergiesText}
              onChangeText={setAllergiesText}
            />
          </View>

          <Button
            className="mt-6"
            size="lg"
            variant="primary"
            isDisabled={loading}
            onPress={handleSave}>
            {loading ? "Saving…" : "Complete Setup"}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
