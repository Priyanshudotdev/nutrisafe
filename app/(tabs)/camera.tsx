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
import { api } from "@/convex/_generated/api";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { MaterialIcon } from "@/components/NutriSafeComponents";

export default function CameraScreen() {
  const identifyFood = useAction(api.ai.identify.identify);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifiedResult, setIdentifiedResult] = useState<any>(null);

  const requestPermissionAndScan = async (source: "camera" | "gallery") => {
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to scan food.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to select photos.");
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
      router.push(`/meal-planner/results?foodIds=${identifiedResult.foodId}`);
    }
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
              <MaterialIcon
                name="arrow_back"
                size={24}
                color={nutriSafeColors.onPrimary}
              />
            </TouchableOpacity>
            <Text style={typography.h2} className="text-on-primary">
              Scan Food
            </Text>
          </View>
          <Text style={typography.bodyMd} className="text-on-primary opacity-90">
            Identify and analyze any food instantly
          </Text>
        </View>

        {/* Instructions */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
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
                name="camera_alt"
                size={24}
                color={nutriSafeColors.onSecondaryContainer}
                filled
              />
            </View>
            <Text style={typography.h3} className="text-on-secondary-container mb-sm font-semibold">
              How it works
            </Text>
            <Text style={typography.bodyMd} className="text-on-secondary-container opacity-90 mb-sm">
              1. Take a photo of any food
            </Text>
            <Text style={typography.bodyMd} className="text-on-secondary-container opacity-90 mb-sm">
              2. Our AI identifies the food
            </Text>
            <Text style={typography.bodyMd} className="text-on-secondary-container opacity-90">
              3. We analyze medical compatibility
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={() => requestPermissionAndScan("camera")}
            style={{
              backgroundColor: nutriSafeColors.primary,
              borderRadius: radii.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <MaterialIcon name="camera_alt" size={24} color={nutriSafeColors.onPrimary} filled />
            <Text style={typography.bodyMd} className="text-on-primary font-semibold">
              Take a Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => requestPermissionAndScan("gallery")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainer,
              borderRadius: radii.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <MaterialIcon
              name="photo_library"
              size={24}
              color={nutriSafeColors.onSurface}
            />
            <Text style={typography.bodyMd} className="text-on-surface font-semibold">
              Upload from Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        {imageUri && !identifiedResult && !identifying && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 256,
                height: 256,
                borderRadius: radii.xl,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: nutriSafeColors.primary,
              }}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </View>
            <Text style={typography.bodyMd} className="text-on-surface-variant mt-md">
              Ready to identify
            </Text>
          </View>
        )}

        {/* Identifying State */}
        {identifying && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <ActivityIndicator size="large" color={nutriSafeColors.primary} />
            <Text
              style={typography.bodyMd}
              className="text-on-surface mt-md font-semibold"
            >
              Vision AI is identifying food...
            </Text>
            <Text style={typography.bodySm} className="text-on-surface-variant mt-xs">
              Checking clinical database
            </Text>
          </View>
        )}

        {/* Identified Result */}
        {identifiedResult && !identifying && (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: nutriSafeColors.outlineVariant,
            }}
          >
            <Text style={typography.labelCaps} className="text-on-surface-variant mb-sm">
              Identified as
            </Text>
            <Text
              style={typography.h1Mobile}
              className="text-on-surface font-bold mb-lg"
            >
              {identifiedResult.identifiedName}
            </Text>

            {identifiedResult.matchFound ? (
              <View
                style={{
                  backgroundColor: `${nutriSafeColors.primaryContainer}20`,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <MaterialIcon
                  name="check_circle"
                  size={24}
                  color={nutriSafeColors.onPrimaryContainer}
                  filled
                />
                <View>
                  <Text style={typography.bodyMd} className="text-on-primary-container font-semibold">
                    Match found!
                  </Text>
                  <Text style={typography.bodySm} className="text-on-primary-container">
                    Food exists in database
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: `${nutriSafeColors.errorContainer}1a`,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                  borderWidth: 1,
                  borderColor: `${nutriSafeColors.error}30`,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginBottom: spacing.sm,
                  }}
                >
                  <MaterialIcon
                    name="warning"
                    size={20}
                    color={nutriSafeColors.onErrorContainer}
                  />
                  <Text style={typography.labelCaps} className="text-error-container">
                    No match found
                  </Text>
                </View>
                <Text style={typography.bodySm} className="text-error-container opacity-90">
                  We identified the food, but we don't have its verified nutritional profile in our
                  local clinical database yet.
                </Text>
              </View>
            )}

            {identifiedResult.matchFound && (
              <TouchableOpacity
                onPress={handleAnalyze}
                style={{
                  backgroundColor: nutriSafeColors.primary,
                  borderRadius: radii.lg,
                  paddingVertical: spacing.lg,
                  alignItems: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={typography.bodyMd} className="text-on-primary font-semibold">
                  Analyze Medical Compatibility
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                setImageUri(null);
                setIdentifiedResult(null);
              }}
              style={{
                backgroundColor: nutriSafeColors.outlineVariant,
                borderRadius: radii.lg,
                paddingVertical: spacing.lg,
                alignItems: "center",
              }}
            >
              <Text style={typography.bodyMd} className="text-on-surface-variant font-semibold">
                Try Another Photo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
