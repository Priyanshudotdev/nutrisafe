import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { Ionicons } from "@expo/vector-icons";
import type { Condition } from "@/convex/rules/types";

const AVAILABLE_CONDITIONS: { id: Condition; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "diabetes", label: "Diabetes", icon: "water-outline" },
  { id: "ckd", label: "Chronic Kidney Disease", icon: "medical-outline" },
  { id: "heart_hypertension", label: "Heart Disease / Hypertension", icon: "heart-outline" },
  { id: "celiac", label: "Celiac Disease", icon: "leaf-outline" },
];

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

export default function MedicalProfileScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const createProfile = useMutation(api.profile.create.create);
  const updateProfile = useMutation(api.profile.update.update);
  const existingProfile = useQuery(api.profile.get.get);

  const isEditing = existingProfile !== null && existingProfile !== undefined;
  const isLoadingProfile = existingProfile === undefined;

  // Form state
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<Condition[]>([]);
  const [allergiesText, setAllergiesText] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-populate form when editing
  useEffect(() => {
    if (existingProfile) {
      setAge(existingProfile.age?.toString() ?? "");
      setGender(existingProfile.gender ?? "");
      setHeight(existingProfile.height?.toString() ?? "");
      setWeight(existingProfile.weight?.toString() ?? "");
      setSelectedConditions((existingProfile.conditions ?? []) as Condition[]);
      setAllergiesText((existingProfile.allergies ?? []).join(", "));
    }
  }, [existingProfile]);

  const toggleCondition = (condition: Condition) => {
    setSelectedConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition]
    );
  };

  const handleSave = async () => {
    if (!age || !gender || !height || !weight) {
      Alert.alert("Required Fields", "Please fill in age, gender, height, and weight.");
      return;
    }

    setLoading(true);
    try {
      const allergiesList = allergiesText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      let finalConditions = [...selectedConditions];
      if (allergiesList.length > 0 && !finalConditions.includes("food_allergy")) {
        finalConditions.push("food_allergy");
      }

      if (isEditing) {
        // Update existing profile
        await updateProfile({
          age: parseInt(age) || undefined,
          gender,
          height: parseInt(height) || undefined,
          weight: parseInt(weight) || undefined,
          conditions: finalConditions,
          allergies: allergiesList,
        });
        router.replace("/(tabs)/profile");
      } else {
        // Create new profile — use real name from session
        const userName = session?.user?.name ?? "User";
        await createProfile({
          name: userName,
          age: parseInt(age) || 30,
          gender,
          height: parseInt(height) || 170,
          weight: parseInt(weight) || 70,
          conditions: finalConditions,
          allergies: allergiesList,
          dietaryPreferences: [],
        });
        // Let index.tsx auth-gate redirect to (tabs)
        router.replace("/");
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: nutriSafeColors.background }}>
        <ActivityIndicator size="large" color={nutriSafeColors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl + (Platform.OS === "ios" ? 20 : 40),
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: spacing.xl }}>
          {isEditing && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                marginBottom: spacing.md,
                alignSelf: "flex-start",
              }}
            >
              <Ionicons name="chevron-back" size={20} color={nutriSafeColors.primary} />
              <Text style={{ ...typography.bodyMd, color: nutriSafeColors.primary, fontWeight: "600" }}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          <Text style={{ ...typography.h1Mobile, color: nutriSafeColors.onSurface }}>
            {isEditing ? "Edit Profile" : "Medical Profile"}
          </Text>
          <Text style={{ ...typography.bodyMd, color: nutriSafeColors.onSurfaceVariant, marginTop: 4 }}>
            {isEditing
              ? "Update your health information"
              : "Personalizing your safety analysis"}
          </Text>
        </View>

        {/* ── Physical Details ── */}
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.md,
            }}
          >
            Physical Details
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
            {/* Age */}
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurface, fontWeight: "600", marginBottom: spacing.xs }}>
                Age
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: nutriSafeColors.surfaceContainerLow,
                  borderRadius: radii.lg,
                  borderWidth: 1.5,
                  borderColor: age ? nutriSafeColors.primary : nutriSafeColors.outlineVariant,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <TextInput
                  placeholder="35"
                  placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                  style={{
                    flex: 1,
                    color: nutriSafeColors.onSurface,
                    paddingVertical: spacing.sm,
                    fontSize: 16,
                  }}
                />
                <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurfaceVariant }}>yrs</Text>
              </View>
            </View>

            {/* Height */}
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurface, fontWeight: "600", marginBottom: spacing.xs }}>
                Height
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: nutriSafeColors.surfaceContainerLow,
                  borderRadius: radii.lg,
                  borderWidth: 1.5,
                  borderColor: height ? nutriSafeColors.primary : nutriSafeColors.outlineVariant,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <TextInput
                  placeholder="175"
                  placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                  keyboardType="numeric"
                  value={height}
                  onChangeText={setHeight}
                  style={{
                    flex: 1,
                    color: nutriSafeColors.onSurface,
                    paddingVertical: spacing.sm,
                    fontSize: 16,
                  }}
                />
                <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurfaceVariant }}>cm</Text>
              </View>
            </View>

            {/* Weight */}
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurface, fontWeight: "600", marginBottom: spacing.xs }}>
                Weight
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: nutriSafeColors.surfaceContainerLow,
                  borderRadius: radii.lg,
                  borderWidth: 1.5,
                  borderColor: weight ? nutriSafeColors.primary : nutriSafeColors.outlineVariant,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <TextInput
                  placeholder="70"
                  placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                  style={{
                    flex: 1,
                    color: nutriSafeColors.onSurface,
                    paddingVertical: spacing.sm,
                    fontSize: 16,
                  }}
                />
                <Text style={{ ...typography.bodySm, color: nutriSafeColors.onSurfaceVariant }}>kg</Text>
              </View>
            </View>
          </View>

          {/* Gender */}
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurface,
              fontWeight: "600",
              marginBottom: spacing.sm,
            }}
          >
            Gender
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGender(g)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.full,
                  backgroundColor:
                    gender === g ? nutriSafeColors.primary : nutriSafeColors.surfaceContainerLow,
                  borderWidth: 1.5,
                  borderColor:
                    gender === g ? nutriSafeColors.primary : nutriSafeColors.outlineVariant,
                }}
              >
                <Text
                  style={{
                    ...typography.bodySm,
                    color: gender === g ? "#ffffff" : nutriSafeColors.onSurface,
                    fontWeight: "600",
                  }}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Health Conditions ── */}
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            }}
          >
            Health Conditions
          </Text>
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              marginBottom: spacing.md,
            }}
          >
            Select all that apply — your analysis rules will be tailored accordingly
          </Text>

          <View style={{ gap: spacing.sm }}>
            {AVAILABLE_CONDITIONS.map((cond) => {
              const isSelected = selectedConditions.includes(cond.id);
              return (
                <TouchableOpacity
                  key={cond.id}
                  onPress={() => toggleCondition(cond.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    borderRadius: radii.lg,
                    backgroundColor: isSelected
                      ? `${nutriSafeColors.primary}12`
                      : nutriSafeColors.surfaceContainerLow,
                    borderWidth: 1.5,
                    borderColor: isSelected
                      ? nutriSafeColors.primary
                      : nutriSafeColors.outlineVariant,
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.lg,
                      backgroundColor: isSelected
                        ? nutriSafeColors.primary
                        : nutriSafeColors.surfaceContainer,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={cond.icon}
                      size={18}
                      color={isSelected ? "#ffffff" : nutriSafeColors.onSurfaceVariant}
                    />
                  </View>
                  <Text
                    style={{
                      ...typography.bodyMd,
                      flex: 1,
                      color: isSelected ? nutriSafeColors.primary : nutriSafeColors.onSurface,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {cond.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={nutriSafeColors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Food Allergies ── */}
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            }}
          >
            Food Allergies
          </Text>
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              marginBottom: spacing.md,
            }}
          >
            Separate multiple items with commas
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: nutriSafeColors.surfaceContainerLow,
              borderRadius: radii.lg,
              borderWidth: 1.5,
              borderColor: allergiesText
                ? nutriSafeColors.primary
                : nutriSafeColors.outlineVariant,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={
                allergiesText ? nutriSafeColors.primary : nutriSafeColors.onSurfaceVariant
              }
            />
            <TextInput
              placeholder="e.g. peanuts, milk, shellfish"
              placeholderTextColor={nutriSafeColors.onSurfaceVariant}
              value={allergiesText}
              onChangeText={setAllergiesText}
              style={{
                flex: 1,
                color: nutriSafeColors.onSurface,
                paddingVertical: spacing.md,
                fontSize: 16,
              }}
            />
          </View>
        </View>

        {/* ── Save Button ── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={{
            backgroundColor: nutriSafeColors.primary,
            borderRadius: radii.xl,
            paddingVertical: spacing.md + 4,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.sm,
            opacity: loading ? 0.7 : 1,
            shadowColor: nutriSafeColors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
          )}
          <Text
            style={{
              ...typography.bodyMd,
              color: "#ffffff",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            {loading
              ? isEditing
                ? "Saving..."
                : "Setting up..."
              : isEditing
              ? "Save Changes"
              : "Complete Setup"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
