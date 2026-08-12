import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAction } from "convex/react";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/convex/_generated/api";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";

export default function CreateScreen() {
  const identifyFood = useAction(api.ai.identify.identify);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifiedResult, setIdentifiedResult] = useState<any>(null);

  const requestPermissionAndScan = async (source: "camera" | "gallery") => {
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to scan food."
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Gallery permission is required to select photos."
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      handleIdentify(result.assets[0].base64);
    }
  };

  const handleIdentify = async (base64String: string) => {
    setIdentifying(true);
    setIdentifiedResult(null);
    try {
      const result = await identifyFood({
        imageBase64: base64String,
        mimeType: "image/jpeg",
      });
      setIdentifiedResult(result);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Identification Failed", e.message);
    } finally {
      setIdentifying(false);
    }
  };

  const handleAnalyze = () => {
    if (identifiedResult?.foodId) {
      router.push(
        `/(tabs)/meal-planner/results?foodIds=${identifiedResult.foodId}`
      );
    }
  };

  const resetScan = () => {
    setImageUri(null);
    setIdentifiedResult(null);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{
              ...typography.h2,
              color: nutriSafeColors.onSurface,
              marginBottom: 4,
            }}
          >
            Scan Food
          </Text>
          <Text
            style={{
              ...typography.bodyMd,
              color: nutriSafeColors.onSurfaceVariant,
            }}
          >
            Identify and analyze any food instantly
          </Text>
        </View>

        {/* Large Camera Preview Area */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            height: 240,
            borderRadius: radii.xl,
            backgroundColor: imageUri
              ? "transparent"
              : nutriSafeColors.surfaceContainerLow,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: imageUri
              ? nutriSafeColors.primary
              : nutriSafeColors.outlineVariant,
            borderStyle: imageUri ? "solid" : "dashed",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ alignItems: "center", gap: spacing.md }}>
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
                  name="camera"
                  size={36}
                  color={nutriSafeColors.primary}
                />
              </View>
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                Take a photo or upload{"\n"}from your gallery
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={() => requestPermissionAndScan("camera")}
            style={{
              backgroundColor: nutriSafeColors.primary,
              borderRadius: radii.xl,
              paddingVertical: spacing.md + 4,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              shadowColor: nutriSafeColors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Ionicons name="camera" size={22} color="#ffffff" />
            <Text
              style={{
                ...typography.bodyMd,
                color: "#ffffff",
                fontWeight: "600",
              }}
            >
              Take a Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => requestPermissionAndScan("gallery")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              paddingVertical: spacing.md + 4,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              borderWidth: 1.5,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <Ionicons
              name="images"
              size={22}
              color={nutriSafeColors.onSurface}
            />
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
              }}
            >
              Upload from Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* How it works Card */}
        {!imageUri && !identifying && !identifiedResult && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              backgroundColor: `${nutriSafeColors.primary}10`,
              borderRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                ...typography.h3,
                color: nutriSafeColors.primary,
                marginBottom: 4,
              }}
            >
              How it works
            </Text>
            {[
              { num: "1", text: "Take a photo of any food item" },
              { num: "2", text: "Our AI identifies the food" },
              { num: "3", text: "We check medical compatibility" },
            ].map((step) => (
              <View
                key={step.num}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radii.full,
                    backgroundColor: nutriSafeColors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#ffffff",
                    }}
                  >
                    {step.num}
                  </Text>
                </View>
                <Text
                  style={{
                    ...typography.bodyMd,
                    color: nutriSafeColors.onSurface,
                    flex: 1,
                  }}
                >
                  {step.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Identifying State */}
        {identifying && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.xl,
              alignItems: "center",
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
              gap: spacing.md,
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
              Vision AI is identifying food...
            </Text>
            <Text
              style={{
                ...typography.bodySm,
                color: nutriSafeColors.onSurfaceVariant,
              }}
            >
              Checking clinical database
            </Text>
          </View>
        )}

        {/* Identified Result Card */}
        {identifiedResult && !identifying && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
              gap: spacing.md,
            }}
          >
            {/* Result header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.full,
                  backgroundColor: identifiedResult.matchFound
                    ? `${nutriSafeColors.primary}20`
                    : `${nutriSafeColors.error}20`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={
                    identifiedResult.matchFound
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={24}
                  color={
                    identifiedResult.matchFound
                      ? nutriSafeColors.primary
                      : nutriSafeColors.error
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.bodySm,
                    color: nutriSafeColors.onSurfaceVariant,
                  }}
                >
                  Identified as
                </Text>
                <Text
                  style={{
                    ...typography.h3,
                    color: nutriSafeColors.onSurface,
                  }}
                >
                  {identifiedResult.identifiedName}
                </Text>
              </View>
            </View>

            {/* Match status */}
            <View
              style={{
                backgroundColor: identifiedResult.matchFound
                  ? `${nutriSafeColors.primary}10`
                  : `${nutriSafeColors.error}10`,
                borderRadius: radii.lg,
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  ...typography.bodyMd,
                  color: identifiedResult.matchFound
                    ? nutriSafeColors.primary
                    : nutriSafeColors.error,
                  fontWeight: "600",
                }}
              >
                {identifiedResult.matchFound
                  ? "✓ Found in our database"
                  : "✗ Not found in our database"}
              </Text>
              {!identifiedResult.matchFound && (
                <Text
                  style={{
                    ...typography.bodySm,
                    color: nutriSafeColors.onSurfaceVariant,
                    marginTop: 4,
                  }}
                >
                  We identified the food, but don't have its verified
                  nutritional profile yet.
                </Text>
              )}
            </View>

            {/* Analyze button */}
            {identifiedResult.matchFound && (
              <TouchableOpacity
                onPress={handleAnalyze}
                style={{
                  backgroundColor: nutriSafeColors.primary,
                  borderRadius: radii.xl,
                  paddingVertical: spacing.md + 4,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    ...typography.bodyMd,
                    color: "#ffffff",
                    fontWeight: "600",
                  }}
                >
                  Analyze Medical Compatibility
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={resetScan}
              style={{
                borderRadius: radii.xl,
                paddingVertical: spacing.md,
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: nutriSafeColors.outlineVariant,
              }}
            >
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.onSurfaceVariant,
                  fontWeight: "600",
                }}
              >
                Try Another Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
