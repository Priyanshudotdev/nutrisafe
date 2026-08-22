import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Image,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors, radius, spacing } from "../../theme/tokens";
import { foodSafetyStore, type FoodSafetyAnalysis, type PatientCondition } from "../../data/foodSafety";
import { DietaryProfileBar } from "../../components/DietaryProfileBar";
import { FoodCheckCard } from "../../components/FoodCheckCard";
import { StepProgressState } from "../../components/StepProgressState";
import { AppButton, AppLinkButton } from "../../components/AppButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { WebCameraCapture } from "../../components/WebCameraCapture";
import {
  analyzeConfirmedFood,
  analyzeFoodFromImage,
  SCAN_ANALYSIS_STEPS,
  type AnalysisStep,
} from "../../services/foodAnalysis";
import type { FoodIdentificationResult } from "../../services/foodVision";
import { updateProfile } from "../../services/profileService";
import { notificationStore } from "../../services/notificationStore";

type ScanPhase = "initial" | "web_camera" | "preview" | "processing" | "result" | "uncertain" | "error";

export default function FoodScannerScreen() {
  const router = useRouter();
  const [conditions, setConditions] = useState<PatientCondition[]>(foodSafetyStore.getSelectedConditions());
  const [phase, setPhase] = useState<ScanPhase>("initial");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<AnalysisStep | undefined>();
  const [identification, setIdentification] = useState<FoodIdentificationResult | null>(null);
  const [result, setResult] = useState<FoodSafetyAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConditionsChange = async (c: PatientCondition[]) => {
    if (c.length === 0) return;
    setConditions(c);
    foodSafetyStore.setSelectedConditions(c);
    try {
      const profile = await updateProfile({ conditions: c });
      foodSafetyStore.hydratePatient(profile);
    } catch {
      /* local selection still applies */
    }
  };

  const requestPermissions = async (forCamera: boolean): Promise<boolean> => {
    if (forCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera access needed", "Allow camera access to scan food, or use Upload Photo instead.");
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Photo access needed", "Allow photo library access to upload a food image.");
        return false;
      }
    }
    return true;
  };

  const handleOpenCamera = async () => {
    if (Platform.OS === "web") {
      setPhase("web_camera");
      return;
    }
    await handlePickImage("camera");
  };

  const handlePickImage = async (source: "camera" | "library") => {
    const permitted = await requestPermissions(source === "camera");
    if (!permitted) {
      if (source === "camera") {
        // Fall back to upload when camera denied
        return;
      }
      return;
    }

    const pickerResult =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
            aspect: [4, 3],
          });

    if (!pickerResult.canceled && pickerResult.assets[0]?.uri) {
      setImageUri(pickerResult.assets[0].uri);
      setPhase("preview");
      setResult(null);
      setIdentification(null);
      setErrorMessage(null);
    }
  };

  const resetScan = () => {
    setPhase("initial");
    setImageUri(null);
    setResult(null);
    setIdentification(null);
    setErrorMessage(null);
    setActiveStep(undefined);
  };

  const runAnalysis = async (foodOverride?: string) => {
    setPhase("processing");
    setActiveStep(undefined);
    setErrorMessage(null);

    try {
      if (foodOverride) {
        const analysis = await analyzeConfirmedFood(foodOverride, conditions, setActiveStep);
        setResult(analysis);
        await notificationStore.push("Food check complete", `${analysis.foodName}: ${analysis.statusHeadline}`);
        setPhase("result");
        return;
      }

      if (!imageUri) return;

      const scanResult = await analyzeFoodFromImage(imageUri, conditions, setActiveStep);
      setIdentification(scanResult.identification);

      if (scanResult.analysis) {
        setResult(scanResult.analysis);
        await notificationStore.push(
          "Food check complete",
          `${scanResult.analysis.foodName}: ${scanResult.analysis.statusHeadline}`
        );
        setPhase("result");
      } else if (scanResult.identification.status === "uncertain" && scanResult.identification.candidates) {
        setPhase("uncertain");
      } else {
        setErrorMessage(scanResult.identification.message);
        setPhase("error");
      }
    } catch {
      setErrorMessage("We couldn't complete the scan. Please try again or search manually.");
      setPhase("error");
    } finally {
      setActiveStep(undefined);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader
        title="Scan Food"
        subtitle="Take a photo to identify a food and check if it's safe for you."
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.profileWrap}>
          <DietaryProfileBar conditions={conditions} onConditionsChange={handleConditionsChange} />
        </View>

        {phase === "initial" && (
          <View style={styles.initialCard}>
            <View style={styles.scanIconCircle}>
              <Ionicons name="camera-outline" size={32} color={colors.primaryDark} />
            </View>
            <Text style={styles.initialText}>
              Point your camera at the food or upload a clear photo of the full dish.
            </Text>
            <AppButton label="Open Camera" onPress={handleOpenCamera} icon="camera" size="lg" />
            <AppButton label="Upload Photo" onPress={() => handlePickImage("library")} variant="secondary" size="lg" icon="image-outline" />
          </View>
        )}

        {phase === "web_camera" && (
          <WebCameraCapture
            onCapture={(dataUri) => {
              setImageUri(dataUri);
              setPhase("preview");
            }}
            onCancel={resetScan}
            onFallbackUpload={() => handlePickImage("library")}
          />
        )}

        {phase === "preview" && imageUri && (
          <View style={styles.previewCard}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} accessibilityLabel="Selected food photo" />
            <View style={styles.previewActions}>
              <AppButton label="Retake" onPress={resetScan} variant="secondary" size="md" style={styles.flexButton} />
              <AppButton label="Use Photo" onPress={() => runAnalysis()} size="md" style={styles.flexButton} />
            </View>
          </View>
        )}

        {phase === "processing" && (
          <StepProgressState visible steps={SCAN_ANALYSIS_STEPS} activeStepId={activeStep} />
        )}

        {phase === "uncertain" && identification?.candidates && (
          <View style={styles.uncertainCard}>
            <Ionicons name="help-circle-outline" size={28} color={colors.moderationIcon} />
            <Text style={styles.uncertainTitle}>Which food is this?</Text>
            <Text style={styles.uncertainText}>{identification.message}</Text>
            {identification.candidates.map((c) => (
              <Pressable key={c.name} style={styles.candidateRow} onPress={() => runAnalysis(c.name)}>
                <Text style={styles.candidateName}>{c.name}</Text>
                {c.confidence > 0 && (
                  <Text style={styles.candidateConf}>{Math.round(c.confidence * 100)}% match</Text>
                )}
              </Pressable>
            ))}
            <AppLinkButton label="Search manually instead" onPress={() => router.push("/(tabs)")} style={styles.linkButton} />
          </View>
        )}

        {phase === "error" && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.dangerIcon} />
            <Text style={styles.errorTitle}>
              {identification?.status === "not_configured"
                ? "Food recognition isn't available"
                : "Couldn't identify this food"}
            </Text>
            <Text style={styles.errorBody}>
              {errorMessage ??
                "Try a clearer, well-lit photo showing the full dish, or search for the food manually."}
            </Text>
            <AppButton label="Try Again" onPress={resetScan} size="md" />
            <AppLinkButton label="Search manually" onPress={() => router.push("/(tabs)")} style={styles.linkButton} />
          </View>
        )}

        {phase === "result" && result && (
          <View style={styles.resultSection}>
            {result.scanConfidence !== undefined && (
              <Text style={styles.confidenceNote}>
                Identified with {Math.round(result.scanConfidence * 100)}% confidence
              </Text>
            )}
            <FoodCheckCard analysis={result} expanded />
            <MedicalDisclaimer />
            <AppButton label="Scan another food" onPress={resetScan} variant="secondary" size="md" />
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.xl },
  profileWrap: { paddingTop: spacing.md },
  initialCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: { fontSize: 14, color: colors.slateMedium, textAlign: "center", lineHeight: 20 },
  previewCard: { marginTop: spacing.xl, gap: spacing.md },
  previewImage: { width: "100%", height: 260, borderRadius: radius.xl, backgroundColor: colors.gray1 },
  previewActions: { flexDirection: "row", gap: spacing.sm },
  flexButton: { flex: 1 },
  uncertainCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.moderationBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  uncertainTitle: { fontSize: 17, fontWeight: "700", color: colors.dark },
  uncertainText: { fontSize: 13, color: colors.slateMedium, lineHeight: 19 },
  candidateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  candidateName: { fontSize: 15, fontWeight: "600", color: colors.dark },
  candidateConf: { fontSize: 12, color: colors.slateMuted },
  errorCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  errorTitle: { fontSize: 17, fontWeight: "700", color: colors.dangerText, textAlign: "center" },
  errorBody: { fontSize: 13, color: colors.dangerText, textAlign: "center", lineHeight: 19 },
  resultSection: { marginTop: spacing.xl, gap: spacing.md },
  confidenceNote: { fontSize: 12, color: colors.slateMuted, fontWeight: "500" },
  linkButton: { marginTop: spacing.xs },
  bottomSpacer: { height: 100 },
});
