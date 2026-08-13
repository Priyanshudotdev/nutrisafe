import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message);
      // Let the index screen's auth-gate redirect to the correct route
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("Sign In Failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Logo ── */}
        <View style={{ alignItems: "center", marginBottom: spacing.xl * 2 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radii.full,
              backgroundColor: nutriSafeColors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="leaf" size={40} color={nutriSafeColors.onPrimary} />
          </View>
          <Text
            style={{ ...typography.h1, color: nutriSafeColors.onSurface, marginTop: spacing.md }}
          >
            NutriSafe
          </Text>
          <Text
            style={{
              ...typography.bodyMd,
              color: nutriSafeColors.onSurfaceVariant,
              marginTop: 4,
            }}
          >
            Welcome back
          </Text>
        </View>

        {/* ── Form ── */}
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {/* Email */}
          <View>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.xs,
              }}
            >
              Email Address
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#ffffff",
                borderRadius: radii.xl,
                borderWidth: 1.5,
                borderColor: nutriSafeColors.outlineVariant,
                paddingHorizontal: spacing.md,
              }}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={nutriSafeColors.onSurfaceVariant}
                style={{ marginRight: spacing.sm }}
              />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  color: nutriSafeColors.onSurface,
                  paddingVertical: spacing.sm,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

          {/* Password */}
          <View>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.xs,
              }}
            >
              Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#ffffff",
                borderRadius: radii.xl,
                borderWidth: 1.5,
                borderColor: nutriSafeColors.outlineVariant,
                paddingHorizontal: spacing.md,
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={nutriSafeColors.onSurfaceVariant}
                style={{ marginRight: spacing.sm }}
              />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  color: nutriSafeColors.onSurface,
                  paddingVertical: spacing.sm,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ padding: spacing.sm }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={nutriSafeColors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={{
              backgroundColor: nutriSafeColors.primary,
              borderRadius: radii.xl,
              paddingVertical: spacing.md + 4,
              alignItems: "center",
              marginTop: spacing.md,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                ...typography.bodyMd,
                color: "#ffffff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </Pressable>
        </View>

        {/* ── Sign Up Link ── */}
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
          <Text style={{ ...typography.bodyMd, color: nutriSafeColors.onSurfaceVariant }}>
            Don't have an account?{" "}
          </Text>
          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.primary,
                fontWeight: "700",
              }}
            >
              Sign Up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
