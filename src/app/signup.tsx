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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, controlHeight, radius, spacing, typography } from "../theme/tokens";
import { AppButton } from "../components/AppButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { signup, formatAuthError } from "../services/authService";
import { getApiBaseUrl } from "../services/apiClient";

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError("Name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace("/onboarding");
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
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={colors.dark} />
          </Pressable>

          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.subheading}>
            Sign up with your email. You&apos;ll set up your health profile next.
          </Text>

          {error && (
            <View style={styles.errorWrap}>
              <ErrorBanner message={error} />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.slateMuted}
              autoComplete="name"
              accessibilityLabel="Full name"
            />
          </View>

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
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.slateMuted}
                accessibilityLabel="Password"
              />
              <Pressable
                style={styles.showPasswordButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.slateLight} />
              </Pressable>
            </View>
          </View>

          <AppButton
            label="Create account"
            onPress={handleSignup}
            size="lg"
            loading={isLoading}
            style={styles.submitButton}
          />

          <Pressable style={styles.linkButton} onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign in</Text>
            </Text>
          </Pressable>

          {__DEV__ && (
            <Text style={styles.devHint}>API: {getApiBaseUrl()}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.lg },
  heading: { ...typography.display, color: colors.dark, marginBottom: 6 },
  subheading: { fontSize: typography.body.fontSize, color: colors.slateMuted, lineHeight: 20, marginBottom: spacing.xl },
  errorWrap: { marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.bodySmall.fontSize,
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
    fontSize: typography.body.fontSize + 1,
    color: colors.dark,
    height: controlHeight.md,
  },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 52 },
  showPasswordButton: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  submitButton: { marginTop: spacing.sm },
  linkButton: { alignItems: "center", marginTop: spacing.xl },
  linkText: { fontSize: typography.bodySmall.fontSize, color: colors.slateMuted },
  linkTextBold: { color: colors.primaryDark, fontWeight: "700" },
  devHint: { marginTop: spacing.xl, fontSize: typography.micro.fontSize, color: colors.slateMuted, textAlign: "center" },
});
