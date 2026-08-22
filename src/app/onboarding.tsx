import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, controlHeight, radius, sectionLabel, spacing, typography } from "../theme/tokens";
import { AppButton } from "../components/AppButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { PATIENT_CONDITIONS, type PatientCondition } from "../data/foodSafety";
import { INDIAN_CITIES } from "../data/indianFoods";
import { completeOnboarding } from "../services/onboardingService";
import { formatAuthError } from "../services/authService";
import { extractPrescriptionFromImage, type PrescriptionExtraction } from "../services/prescriptionVision";
import { authStore } from "../services/authStore";

type PrescriptionPhase = "idle" | "extracting" | "preview" | "applied";

export default function OnboardingScreen() {
  const router = useRouter();
  const existing = authStore.getProfile();
  const [conditions, setConditions] = useState<PatientCondition[]>(
    existing?.conditions && existing.conditions.length > 0
      ? existing.conditions
      : existing?.primaryCondition
        ? [existing.primaryCondition]
        : []
  );
  const [age, setAge] = useState(existing?.age != null ? String(existing.age) : "");
  const [gender, setGender] = useState(existing?.gender ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [doctorName, setDoctorName] = useState(existing?.doctorName ?? "");
  const [allergens, setAllergens] = useState((existing?.allergensList ?? []).join(", "));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rxPhase, setRxPhase] = useState<PrescriptionPhase>("idle");
  const [rxResult, setRxResult] = useState<PrescriptionExtraction | null>(null);
  const [rxError, setRxError] = useState<string | null>(null);

  const toggleCondition = (c: PatientCondition) => {
    setError(null);
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handlePickPrescription = async (source: "camera" | "library") => {
    const permitted =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permitted.status !== "granted") {
      setRxError("Allow photo access to scan your prescription, or fill the form manually.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });

    if (result.canceled || !result.assets[0]?.uri) return;

    setRxPhase("extracting");
    setRxError(null);
    setRxResult(null);

    const extraction = await extractPrescriptionFromImage(result.assets[0].uri);
    if (extraction.status === "success") {
      setRxResult(extraction);
      setRxPhase("preview");
    } else {
      setRxError(extraction.message);
      setRxPhase("idle");
    }
  };

  const applyPrescription = () => {
    if (!rxResult) return;
    if (rxResult.conditions && rxResult.conditions.length > 0) {
      setConditions(rxResult.conditions);
    }
    if (rxResult.allergensList && rxResult.allergensList.length > 0) {
      setAllergens(rxResult.allergensList.join(", "));
    }
    if (rxResult.notes) {
      setNotes(rxResult.notes);
    }
    if (rxResult.doctorName) {
      setDoctorName(rxResult.doctorName);
    }
    setRxPhase("applied");
  };

  const handleContinue = async () => {
    if (conditions.length === 0) {
      setError("Select at least one medical condition to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ageNum = age.trim() ? parseInt(age.trim(), 10) : null;
      if (age.trim() && (Number.isNaN(ageNum!) || ageNum! < 1 || ageNum! > 120)) {
        setError("Enter a valid age between 1 and 120, or leave it blank.");
        setIsLoading(false);
        return;
      }

      await completeOnboarding({
        conditions,
        age: ageNum,
        gender: gender.trim() || null,
        city: city.trim() || null,
        notes: notes.trim(),
        doctorName: doctorName.trim() || null,
        allergensList: allergens
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      });
      router.replace("/(tabs)");
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Almost there</Text>
          <Text style={styles.heading}>Your health profile</Text>
          <Text style={styles.subheading}>
            Select every condition that applies — foods are checked against all of them, combined.
          </Text>

          {error && (
            <View style={styles.errorWrap}>
              <ErrorBanner message={error} />
            </View>
          )}

          {/* ─── Prescription scan (optional, AI) ─── */}
          <View style={styles.rxCard}>
            <View style={styles.rxHeader}>
              <View style={styles.rxIcon}>
                <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
              </View>
              <View style={styles.rxHeaderTextWrap}>
                <Text style={styles.rxTitle}>Doctor&apos;s prescription</Text>
                <Text style={styles.rxSubtitle}>
                  Take a photo and we&apos;ll pre-fill your profile automatically. Optional.
                </Text>
              </View>
            </View>

            {rxPhase === "idle" && (
              <>
                {rxError && (
                  <View style={styles.rxBanner}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.slateMedium} />
                    <Text style={styles.rxBannerText}>{rxError}</Text>
                  </View>
                )}
                <View style={styles.rxActions}>
                  <AppButton
                    label="Take Photo"
                    onPress={() => handlePickPrescription("camera")}
                    size="sm"
                    icon="camera-outline"
                    style={styles.flex}
                  />
                  <AppButton
                    label="Upload"
                    onPress={() => handlePickPrescription("library")}
                    variant="secondary"
                    size="sm"
                    icon="image-outline"
                    style={styles.flex}
                  />
                </View>
              </>
            )}

            {rxPhase === "extracting" && (
              <View style={styles.rxExtracting}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.rxExtractingText}>Reading your prescription…</Text>
              </View>
            )}

            {rxPhase === "preview" && rxResult && (
              <View style={styles.rxPreview}>
                <View style={styles.rxPreviewHeader}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.safeIcon} />
                  <Text style={styles.rxPreviewTitle}>
                    Found in {rxResult.documentType ?? "document"}
                  </Text>
                </View>
                {rxResult.summary ? (
                  <Text style={styles.rxSummary}>{rxResult.summary}</Text>
                ) : null}
                {rxResult.conditions && rxResult.conditions.length > 0 && (
                  <View style={styles.rxFoundRow}>
                    <Text style={styles.rxFoundLabel}>Conditions:</Text>
                    <View style={styles.rxChips}>
                      {rxResult.conditions.map((c) => (
                        <View key={c} style={styles.rxChip}>
                          <Text style={styles.rxChipText}>
                            {PATIENT_CONDITIONS.find((x) => x.id === c)?.shortName ?? c}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {rxResult.allergensList && rxResult.allergensList.length > 0 && (
                  <View style={styles.rxFoundRow}>
                    <Text style={styles.rxFoundLabel}>Allergens:</Text>
                    <Text style={styles.rxFoundValue}>{rxResult.allergensList.join(", ")}</Text>
                  </View>
                )}
                {rxResult.doctorName ? (
                  <Text style={styles.rxFoundValue}>Doctor: {rxResult.doctorName}</Text>
                ) : null}
                <AppButton
                  label="Apply to my profile"
                  onPress={applyPrescription}
                  size="sm"
                  icon="download-outline"
                  style={styles.rxApplyButton}
                />
              </View>
            )}

            {rxPhase === "applied" && (
              <View style={[styles.rxPreview, styles.rxApplied]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.safeIcon} />
                <Text style={styles.rxAppliedText}>
                  Applied below — review and edit anything before continuing.
                </Text>
              </View>
            )}
          </View>

          {/* ─── Conditions (multi-select) ─── */}
          <Text style={styles.label}>Medical conditions * (select all that apply)</Text>
          <View style={styles.conditionGrid}>
            {PATIENT_CONDITIONS.map((cond) => {
              const selected = conditions.includes(cond.id);
              return (
                <Pressable
                  key={cond.id}
                  style={[
                    styles.conditionCard,
                    selected && { borderColor: cond.accentColor, backgroundColor: cond.bgColor },
                  ]}
                  onPress={() => toggleCondition(cond.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.conditionCardTop}>
                    <Ionicons
                      name={cond.iconName as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={selected ? cond.accentColor : colors.slateLight}
                    />
                    <View
                      style={[
                        styles.conditionCheck,
                        selected && { backgroundColor: cond.accentColor, borderColor: cond.accentColor },
                      ]}
                    >
                      {selected && <Ionicons name="checkmark" size={12} color={colors.white} />}
                    </View>
                  </View>
                  <Text style={[styles.conditionTitle, selected && { color: cond.accentColor }]}>
                    {cond.shortName}
                  </Text>
                  <Text style={styles.conditionDesc} numberOfLines={2}>
                    {cond.badgeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.half]}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="Optional"
                placeholderTextColor={colors.slateMuted}
              />
            </View>
            <View style={[styles.field, styles.half]}>
              <Text style={styles.label}>Gender</Text>
              <TextInput
                style={styles.input}
                value={gender}
                onChangeText={setGender}
                placeholder="Optional"
                placeholderTextColor={colors.slateMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>City (India)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
              {INDIAN_CITIES.map((c) => {
                const selected = city === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.cityPill, selected && styles.cityPillActive]}
                    onPress={() => setCity(selected ? "" : c)}
                  >
                    <Text style={[styles.cityText, selected && styles.cityTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Known allergens</Text>
            <TextInput
              style={styles.input}
              value={allergens}
              onChangeText={setAllergens}
              placeholder="e.g. Peanuts, Shellfish"
              placeholderTextColor={colors.slateMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Doctor&apos;s name</Text>
            <TextInput
              style={styles.input}
              value={doctorName}
              onChangeText={setDoctorName}
              placeholder="Optional"
              placeholderTextColor={colors.slateMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional preferences or doctor guidance"
              placeholderTextColor={colors.slateMuted}
              multiline
            />
          </View>

          <AppButton
            label={`Continue${conditions.length > 0 ? ` · ${conditions.length} condition${conditions.length > 1 ? "s" : ""}` : ""}`}
            onPress={handleContinue}
            size="lg"
            loading={isLoading}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  eyebrow: { ...sectionLabel, color: colors.primaryDark, marginBottom: spacing.sm },
  heading: { ...typography.display, color: colors.dark, marginBottom: 6 },
  subheading: { fontSize: typography.body.fontSize, color: colors.slateMuted, lineHeight: 20, marginBottom: spacing.xl },
  errorWrap: { marginBottom: spacing.lg },

  // ─── Prescription card ───
  rxCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  rxHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  rxIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rxHeaderTextWrap: { flex: 1, gap: 2 },
  rxTitle: { fontSize: typography.title.fontSize, fontWeight: "700", color: colors.dark },
  rxSubtitle: { fontSize: typography.caption.fontSize, color: colors.slateMuted, lineHeight: 16 },
  rxActions: { flexDirection: "row", gap: spacing.sm },
  rxBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rxBannerText: { flex: 1, fontSize: 12, color: colors.slateMedium, lineHeight: 17 },
  rxExtracting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rxExtractingText: { fontSize: typography.bodySmall.fontSize, color: colors.slateMedium, fontWeight: "600" },
  rxPreview: {
    backgroundColor: colors.safeBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.safeBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rxApplied: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rxAppliedText: { flex: 1, fontSize: 12, color: colors.safeText, fontWeight: "600", lineHeight: 17 },
  rxPreviewHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  rxPreviewTitle: { fontSize: 13, fontWeight: "700", color: colors.safeText, textTransform: "capitalize" },
  rxSummary: { fontSize: 12, color: colors.slateMedium, lineHeight: 17 },
  rxFoundRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  rxFoundLabel: { fontSize: 12, fontWeight: "700", color: colors.slateLight },
  rxFoundValue: { fontSize: 12, color: colors.slateMedium, flexShrink: 1 },
  rxChips: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  rxChip: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.safeBorder,
  },
  rxChipText: { fontSize: typography.micro.fontSize, fontWeight: "700", color: colors.safeText },
  rxApplyButton: { flex: 1, marginTop: 2 },

  // ─── Form ───
  label: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  conditionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  conditionCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: 4,
  },
  conditionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conditionCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gray3,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionTitle: { fontSize: typography.body.fontSize, fontWeight: "700", color: colors.dark, marginTop: 4 },
  conditionDesc: { fontSize: typography.micro.fontSize, color: colors.slateMuted, lineHeight: 15 },
  row: { flexDirection: "row", gap: spacing.md },
  field: { marginBottom: spacing.lg },
  half: { flex: 1 },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body.fontSize + 1,
    color: colors.dark,
    height: controlHeight.md,
  },
  notesInput: { height: undefined, minHeight: 88, textAlignVertical: "top", paddingVertical: spacing.md },
  cityRow: { gap: spacing.sm },
  cityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
    marginRight: spacing.sm,
  },
  cityPillActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  cityText: { fontSize: typography.bodySmall.fontSize, fontWeight: "600", color: colors.slateMedium },
  cityTextActive: { color: colors.primaryDark },
  submitButton: { marginTop: spacing.sm },
});
