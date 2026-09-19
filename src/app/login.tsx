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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { controlHeight, radius, spacing, typography, type ThemeColors } from "../theme/tokens";
import { useThemeColors } from "../hooks/useThemeColors";
import { AppButton } from "../components/AppButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { login, formatAuthError } from "../services/authService";
import { needsOnboarding } from "../services/onboardingService";
import { getApiBaseUrl } from "../services/apiClient";

export default function LoginScreen() {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await login(trimEmail, password);
      if (needsOnboarding(profile)) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Ionicons name="nutrition" size={32} color={colors.primaryText} />
            </View>
            <Text style={styles.appName}>NutriCheck</Text>
            <Text style={styles.tagline}>Food safety for your health profile</Text>
          </View>

          <Text style={styles.heading}>Sign in</Text>

          {error && (
            <View style={styles.errorWrap}>
              <ErrorBanner message={error} onRetry={handleLogin} />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
              placeholderTextColor={colors.slateMuted}
              accessibilityLabel="Email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.slateMuted}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <Pressable
                style={styles.showPasswordButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: showPassword }}
                accessibilityHint={showPassword ? "Hide password text" : "Show password text"}
                hitSlop={12}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.slateLight} />
              </Pressable>
            </View>
          </View>

          <AppButton
            label="Sign in"
            onPress={handleLogin}
            size="lg"
            loading={isLoading}
            style={styles.submitButton}
          />

          <Pressable style={styles.linkButton} onPress={() => router.push("/signup")} accessibilityRole="link" accessibilityHint="Go to sign up">
            <Text style={styles.linkText}>
              Don&apos;t have an account? <Text style={styles.linkTextBold}>Create one</Text>
            </Text>
          </Pressable>

          {__DEV__ && <Text style={styles.devHint}>API: {getApiBaseUrl()}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xxl },
  logoArea: { alignItems: "center", marginBottom: spacing.xxxl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  appName: { ...typography.heading, color: colors.dark },
  tagline: { ...typography.bodySmall, color: colors.slateMuted, marginTop: spacing.xs },
  heading: { ...typography.heading, color: colors.dark, marginBottom: spacing.lg },
  errorWrap: { marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.dark,
    height: controlHeight.md,
  },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: spacing.xxxl + spacing.xl },
  showPasswordButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
  },
  submitButton: { marginTop: spacing.sm },
  linkButton: { alignItems: "center", marginTop: spacing.xl },
  linkText: { ...typography.bodySmall, color: colors.slateMuted },
  linkTextBold: { color: colors.primaryText, fontWeight: "700" },
  devHint: { marginTop: spacing.xl, ...typography.micro, color: colors.slateMuted, textAlign: "center" },
});
