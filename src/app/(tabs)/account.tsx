import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  StatusBar,
  Switch,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  foodSafetyStore,
  PATIENT_CONDITIONS,
  type PatientCondition,
  type PatientProfile,
} from "../../data/foodSafety";
import { INDIAN_CITIES } from "../../data/indianFoods";
import { colors, controlHeight, radius, sectionLabel, spacing, typography } from "../../theme/tokens";
import { SegmentControl } from "../../components/SegmentControl";
import { AppButton } from "../../components/AppButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { updateProfile } from "../../services/profileService";
import { changeEmail, changePassword, logout, ApiError } from "../../services/authService";
import { clearHistory as clearServerHistory } from "../../services/historyService";
import { extractPrescriptionFromImage } from "../../services/prescriptionVision";
import { type ThemeMode } from "../../services/themeStore";
import { notificationStore } from "../../services/notificationStore";
import { useTheme } from "../../hooks/useTheme";
import { authStore } from "../../services/authStore";

type AccountTab = "profile" | "preferences" | "account";

type EditField = "name" | "age" | "gender" | "notes" | "email" | "password" | null;

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}

function SettingsRow({ icon, label, subtitle, onPress, trailing, destructive }: SettingsRowProps) {
  return (
    <Pressable
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!onPress && !trailing}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={[styles.settingsIcon, destructive && styles.settingsIconDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.dangerIcon : colors.primaryDark} />
      </View>
      <View style={styles.settingsText}>
        <Text style={[styles.settingsLabel, destructive && styles.settingsLabelDestructive]}>{label}</Text>
        {subtitle ? <Text style={styles.settingsSubtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.gray3} /> : null)}
    </Pressable>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState<AccountTab>("profile");
  const [patient, setPatient] = useState<PatientProfile>(foodSafetyStore.getPatient());
  const [historyCount, setHistoryCount] = useState(foodSafetyStore.getHistory().length);
  const [notifEnabled, setNotifEnabled] = useState(notificationStore.isEnabled());
  const [unread, setUnread] = useState(notificationStore.unreadCount());
  const [notifications, setNotifications] = useState(notificationStore.getItems());

  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [editValue2, setEditValue2] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [rxScanning, setRxScanning] = useState(false);

  useEffect(() => {
    const unsubStore = foodSafetyStore.subscribe(() => {
      setPatient(foodSafetyStore.getPatient());
      setHistoryCount(foodSafetyStore.getHistory().length);
    });
    const unsubAuth = authStore.subscribe(() => {
      const p = authStore.getProfile();
      if (p) {
        foodSafetyStore.hydratePatient(p);
        setPatient(p);
      }
    });
    const unsubNotif = notificationStore.subscribe(() => {
      setNotifEnabled(notificationStore.isEnabled());
      setUnread(notificationStore.unreadCount());
      setNotifications(notificationStore.getItems());
    });
    return () => {
      unsubStore();
      unsubAuth();
      unsubNotif();
    };
  }, []);

  const activeConditions =
    Array.isArray(patient.conditions) && patient.conditions.length > 0
      ? patient.conditions
      : [patient.primaryCondition];

  const openEdit = (field: EditField, initial = "") => {
    setEditField(field);
    setEditValue(initial);
    setEditValue2("");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editField) return;
    setSaving(true);
    setEditError(null);

    try {
      if (editField === "name") {
        if (!editValue.trim()) throw new Error("Name is required.");
        const profile = await updateProfile({ name: editValue.trim() });
        foodSafetyStore.hydratePatient(profile);
      } else if (editField === "age") {
        const age = parseInt(editValue, 10);
        if (Number.isNaN(age) || age < 1 || age > 120) throw new Error("Enter a valid age (1–120).");
        const profile = await updateProfile({ age });
        foodSafetyStore.hydratePatient(profile);
      } else if (editField === "gender") {
        if (!editValue.trim()) throw new Error("Gender is required.");
        const profile = await updateProfile({ gender: editValue.trim() });
        foodSafetyStore.hydratePatient(profile);
      } else if (editField === "notes") {
        const profile = await updateProfile({ notes: editValue });
        foodSafetyStore.hydratePatient(profile);
      } else if (editField === "email") {
        if (!editValue.trim() || !editValue2) throw new Error("New email and current password are required.");
        const profile = await changeEmail(editValue.trim().toLowerCase(), editValue2);
        foodSafetyStore.hydratePatient(profile);
      } else if (editField === "password") {
        if (!editValue || !editValue2) throw new Error("Current and new password are required.");
        if (editValue2.length < 8) throw new Error("New password must be at least 8 characters.");
        await changePassword(editValue, editValue2);
        await notificationStore.push("Password updated", "Your password was changed successfully.");
      }
      setEditField(null);
    } catch (e) {
      setEditError(e instanceof ApiError || e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleConditionsChange = async (newConditions: PatientCondition[]) => {
    if (newConditions.length === 0) return;
    try {
      const profile = await updateProfile({ conditions: newConditions });
      foodSafetyStore.hydratePatient(profile);
      foodSafetyStore.setSelectedConditions(newConditions);
    } catch (e) {
      Alert.alert("Update failed", e instanceof ApiError ? e.message : "Could not update conditions.");
    }
  };

  const toggleCondition = (c: PatientCondition) => {
    const current = Array.isArray(patient.conditions) && patient.conditions.length > 0
      ? patient.conditions
      : [patient.primaryCondition];
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    if (next.length === 0) return;
    handleConditionsChange(next);
  };

  const handleScanPrescription = async (source: "camera" | "library") => {
    const permitted =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permitted.status !== "granted") {
      Alert.alert("Access needed", "Allow photo access to scan a prescription.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]?.uri) return;

    setRxScanning(true);
    const extraction = await extractPrescriptionFromImage(result.assets[0].uri);
    setRxScanning(false);

    if (extraction.status !== "success") {
      Alert.alert("Couldn't read prescription", extraction.message);
      return;
    }

    const found = [
      extraction.conditions?.length ? `Conditions: ${extraction.conditions.join(", ")}` : null,
      extraction.allergensList?.length ? `Allergens: ${extraction.allergensList.join(", ")}` : null,
      extraction.doctorName ? `Doctor: ${extraction.doctorName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    Alert.alert(
      "Prescription scanned",
      `${extraction.summary ?? ""}\n\n${found}\n\nApply these to your profile?`.trim(),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply",
          onPress: async () => {
            try {
              const profile = await updateProfile({
                ...(extraction.conditions && extraction.conditions.length > 0
                  ? { conditions: extraction.conditions }
                  : {}),
                ...(extraction.allergensList && extraction.allergensList.length > 0
                  ? { allergensList: extraction.allergensList }
                  : {}),
                ...(extraction.notes ? { notes: extraction.notes } : {}),
                ...(extraction.doctorName ? { doctorName: extraction.doctorName } : {}),
              });
              foodSafetyStore.hydratePatient(profile);
              await notificationStore.push("Profile updated", "Prescription details applied to your health profile.");
            } catch (e) {
              Alert.alert("Update failed", e instanceof ApiError ? e.message : "Could not apply prescription.");
            }
          },
        },
      ]
    );
  };

  const handleSetCity = () => {
    Alert.alert("Set location", "Choose your city for locally relevant alternatives.", [
      ...INDIAN_CITIES.map((city) => ({
        text: city,
        onPress: async () => {
          try {
            const profile = await updateProfile({ city });
            foodSafetyStore.hydratePatient(profile);
          } catch (e) {
            Alert.alert("Update failed", e instanceof ApiError ? e.message : "Could not update location.");
          }
        },
      })),
      {
        text: "Clear location",
        style: "destructive",
        onPress: async () => {
          try {
            const profile = await updateProfile({ city: null });
            foodSafetyStore.hydratePatient(profile);
          } catch {
            /* ignore */
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleClearHistory = () => {
    const count = foodSafetyStore.getHistory().length;
    if (count === 0) {
      Alert.alert("Nothing to clear", "You have no saved food checks yet.");
      return;
    }
    Alert.alert(
      "Clear history?",
      `This removes all ${count} saved food check${count === 1 ? "" : "s"} from this device and your account. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear history",
          style: "destructive",
          onPress: async () => {
            foodSafetyStore.clearHistory();
            try {
              await clearServerHistory();
            } catch {
              /* local already cleared */
            }
            await notificationStore.push("History cleared", `${count} saved check${count === 1 ? "" : "s"} removed.`);
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Log out of NutriCheck?", "Your profile and history stay synced to your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          foodSafetyStore.setHistory([]);
          router.replace("/login");
        },
      },
    ]);
  };

  const themeLabel = (m: ThemeMode) => (m === "system" ? "System" : m === "dark" ? "Dark" : "Light");

  const cycleTheme = () => {
    const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    setMode(next);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="Account" />

      <View style={styles.segmentWrap}>
        <SegmentControl
          segments={[
            { id: "profile", label: "Profile" },
            { id: "preferences", label: "Preferences" },
            { id: "account", label: "Account" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tab === "profile" && (
          <>
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{(patient.name || "U").substring(0, 2).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.avatarName}>{patient.name}</Text>
                <Text style={styles.avatarSubtitle}>
                  {patient.age != null ? `${patient.age} yrs` : "Age not set"}
                  {" · "}
                  {patient.gender ?? "Gender not set"}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <SettingsRow
                icon="person-outline"
                label="Name"
                subtitle={patient.name}
                onPress={() => openEdit("name", patient.name)}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="calendar-outline"
                label="Age"
                subtitle={patient.age != null ? `${patient.age} years` : "Tap to set"}
                onPress={() => openEdit("age", patient.age != null ? String(patient.age) : "")}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="male-female-outline"
                label="Gender"
                subtitle={patient.gender ?? "Tap to set"}
                onPress={() => openEdit("gender", patient.gender ?? "")}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="document-text-outline"
                label="Notes"
                subtitle={patient.notes || "Tap to add notes"}
                onPress={() => openEdit("notes", patient.notes)}
              />
            </View>

            <View style={[styles.conditionCard, { backgroundColor: colors.primaryMuted, borderColor: `${colors.primary}33` }]}>
              <Text style={styles.conditionLabel}>
                Medical conditions · {activeConditions.length} selected
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conditionPills}>
                {PATIENT_CONDITIONS.map((cond) => {
                  const selected = activeConditions.includes(cond.id);
                  return (
                    <Pressable
                      key={cond.id}
                      style={[styles.conditionPill, selected && { borderColor: cond.accentColor, backgroundColor: colors.cardBg }]}
                      onPress={() => toggleCondition(cond.id)}
                    >
                      <Text style={[styles.conditionPillText, selected && { color: cond.accentColor }]}>{cond.shortName}</Text>
                      {selected && <Ionicons name="checkmark" size={12} color={cond.accentColor} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.rxScanRow}>
                {rxScanning ? (
                  <AppButton label="Reading prescription…" size="sm" loading style={styles.rxButton} />
                ) : (
                  <>
                    <AppButton
                      label="Scan Rx"
                      onPress={() => handleScanPrescription("camera")}
                      size="sm"
                      icon="camera-outline"
                      style={styles.rxButton}
                    />
                    <AppButton
                      label="Upload Photo"
                      onPress={() => handleScanPrescription("library")}
                      variant="secondary"
                      size="sm"
                      icon="image-outline"
                      style={styles.rxButton}
                    />
                  </>
                )}
              </View>
            </View>
          </>
        )}

        {tab === "preferences" && (
          <>
            <View style={styles.card}>
              <SettingsRow
                icon="moon-outline"
                label="Theme"
                subtitle={themeLabel(mode)}
                onPress={cycleTheme}
                trailing={
                  <Switch
                    value={mode === "dark"}
                    onValueChange={(on) => setMode(on ? "dark" : "light")}
                    trackColor={{ false: colors.gray2, true: colors.primary }}
                  />
                }
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="location-outline"
                label="Location"
                subtitle={patient.city ?? "Not set — uses India-wide suggestions"}
                onPress={handleSetCity}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="notifications-outline"
                label="In-app notifications"
                subtitle={notifEnabled ? `${unread} unread` : "Off"}
                trailing={
                  <Switch
                    value={notifEnabled}
                    onValueChange={(v) => notificationStore.setEnabled(v)}
                    trackColor={{ false: colors.gray2, true: colors.primary }}
                  />
                }
              />
            </View>

            {notifications.length > 0 && (
              <View style={styles.card}>
                <View style={styles.notifHeader}>
                  <Text style={styles.cardTitle}>Recent notifications</Text>
                  <Pressable onPress={() => notificationStore.markAllRead()}>
                    <Text style={styles.linkSmall}>Mark all read</Text>
                  </Pressable>
                </View>
                {notifications.slice(0, 5).map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <Text style={[styles.notifTitle, !n.read && styles.notifUnread]}>{n.title}</Text>
                    <Text style={styles.notifBody}>{n.body}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {tab === "account" && (
          <>
            <View style={styles.card}>
              <SettingsRow
                icon="mail-outline"
                label="Email"
                subtitle={patient.email ?? "Not set"}
                onPress={() => openEdit("email", patient.email ?? "")}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="key-outline"
                label="Password & security"
                subtitle="Change password"
                onPress={() => openEdit("password")}
              />
              <View style={styles.divider} />
              <SettingsRow icon="log-out-outline" label="Log out" destructive onPress={handleLogout} />
            </View>

            <Text style={styles.sectionLabel}>Privacy & data</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="shield-outline"
                label="Data handling"
                subtitle="Profile & history sync to your NutriCheck account"
                onPress={() =>
                  Alert.alert(
                    "Data handling",
                    "Your profile and food-check history are stored on the NutriCheck API server (in-memory for this development build). Vision API keys stay on the server."
                  )
                }
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="time-outline"
                label="Search history"
                subtitle={`${historyCount} saved check${historyCount === 1 ? "" : "s"}`}
                onPress={handleClearHistory}
              />
            </View>
          </>
        )}

        <MedicalDisclaimer />
        <Text style={styles.appInfo}>NutriCheck · v1.0.0</Text>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={editField !== null} transparent animationType="slide" onRequestClose={() => setEditField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {editField === "password"
                ? "Change password"
                : editField === "email"
                  ? "Change email"
                  : `Edit ${editField}`}
            </Text>

            {editError && <Text style={styles.modalError}>{editError}</Text>}

            {editField === "password" ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Current password"
                  placeholderTextColor={colors.slateMuted}
                  secureTextEntry
                  value={editValue}
                  onChangeText={setEditValue}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor={colors.slateMuted}
                  secureTextEntry
                  value={editValue2}
                  onChangeText={setEditValue2}
                />
              </>
            ) : editField === "email" ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="New email"
                  placeholderTextColor={colors.slateMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={editValue}
                  onChangeText={setEditValue}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Current password"
                  placeholderTextColor={colors.slateMuted}
                  secureTextEntry
                  value={editValue2}
                  onChangeText={setEditValue2}
                />
              </>
            ) : (
              <TextInput
                style={[styles.modalInput, editField === "notes" && styles.modalInputTall]}
                placeholder={editField === "age" ? "Age" : "Value"}
                placeholderTextColor={colors.slateMuted}
                keyboardType={editField === "age" ? "number-pad" : "default"}
                multiline={editField === "notes"}
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
              />
            )}

            <View style={styles.modalActions}>
              <AppButton label="Cancel" onPress={() => setEditField(null)} variant="secondary" size="md" style={styles.flex} />
              <AppButton
                label="Save"
                onPress={saveEdit}
                size="md"
                loading={saving}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  segmentWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  scrollContent: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "800", color: colors.primaryDark },
  avatarName: { ...typography.subheading, color: colors.dark },
  avatarSubtitle: { fontSize: typography.caption.fontSize, color: colors.slateMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    padding: spacing.lg,
  },
  cardTitle: { ...typography.title, color: colors.dark },
  conditionCard: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1.5, gap: spacing.sm },
  conditionLabel: { fontSize: 12, fontWeight: "600", color: colors.slateLight },
  conditionTitle: { fontSize: 16, fontWeight: "800" },
  conditionPills: { gap: spacing.sm, paddingTop: spacing.sm, alignItems: "center" },
  conditionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    marginRight: spacing.sm,
    backgroundColor: "transparent",
  },
  conditionPillText: { fontSize: 12, fontWeight: "600", color: colors.slateMedium },
  rxScanRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  rxButton: { flex: 1 },
  sectionLabel: { ...sectionLabel, marginTop: spacing.sm },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIconDestructive: { backgroundColor: colors.dangerBg },
  settingsText: { flex: 1, gap: 2 },
  settingsLabel: { ...typography.title, color: colors.dark },
  settingsLabelDestructive: { color: colors.dangerText },
  settingsSubtitle: { fontSize: typography.caption.fontSize, color: colors.slateMuted },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.sm },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  linkSmall: { fontSize: typography.caption.fontSize, fontWeight: "600", color: colors.primaryDark },
  notifItem: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  notifTitle: { fontSize: typography.bodySmall.fontSize, fontWeight: "600", color: colors.slateMedium },
  notifUnread: { color: colors.dark, fontWeight: "700" },
  notifBody: { fontSize: typography.caption.fontSize, color: colors.slateMuted, marginTop: 2 },
  appInfo: { fontSize: typography.micro.fontSize, color: colors.slateMuted, textAlign: "center" },
  bottomSpacer: { height: 100 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  modalTitle: { fontSize: typography.subheading.fontSize, fontWeight: "700", color: colors.dark },
  modalError: { fontSize: typography.bodySmall.fontSize, color: colors.dangerText },
  modalInput: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body.fontSize + 1,
    color: colors.dark,
    height: controlHeight.md,
  },
  modalInputTall: { height: undefined, minHeight: 100, textAlignVertical: "top", paddingVertical: spacing.md },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
