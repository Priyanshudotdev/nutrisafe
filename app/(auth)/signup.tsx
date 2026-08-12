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

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (error) throw new Error(error.message);

      const { data: session, error: sessionError } = await authClient.getSession({
        fetchOptions: { throw: false },
      });
      if (sessionError || !session?.session) {
        throw new Error("Authentication succeeded, but the session could not be loaded.");
      }

      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign Up Failed", e.message);
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
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
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
            <Ionicons
              name="leaf"
              size={40}
              color={nutriSafeColors.onPrimary}
            />
          </View>
          <Text
            style={{
              ...typography.h1,
              color: nutriSafeColors.onSurface,
              marginTop: spacing.md,
            }}
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
            Create your account
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <View>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.xs,
              }}
            >
              Full Name
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
                name="person-outline"
                size={20}
                color={nutriSafeColors.onSurfaceVariant}
                style={{ marginRight: spacing.sm }}
              />
              <TextInput
                placeholder="Enter your name"
                placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                value={name}
                onChangeText={setName}
                style={{
                  flex: 1,
                  color: nutriSafeColors.onSurface,
                  paddingVertical: spacing.sm,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

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
                style={{
                  flex: 1,
                  color: nutriSafeColors.onSurface,
                  paddingVertical: spacing.sm,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

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

          <View>
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.onSurface,
                fontWeight: "600",
                marginBottom: spacing.xs,
              }}
            >
              Confirm Password
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
                placeholder="Confirm your password"
                placeholderTextColor={nutriSafeColors.onSurfaceVariant}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                style={{
                  flex: 1,
                  color: nutriSafeColors.onSurface,
                  paddingVertical: spacing.sm,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ padding: spacing.sm }}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={nutriSafeColors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSignup}
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
              {loading ? "Creating account..." : "Sign Up"}
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            marginVertical: spacing.lg,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: nutriSafeColors.outlineVariant,
            }}
          />
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
            }}
          >
            or
          </Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: nutriSafeColors.outlineVariant,
            }}
          />
        </View>

        {/* Login Link */}
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              ...typography.bodyMd,
              color: nutriSafeColors.onSurface,
            }}
          >
            Already have an account?{" "}
          </Text>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            style={{ marginTop: spacing.xs }}
          >
            <Text
              style={{
                ...typography.bodyMd,
                color: nutriSafeColors.primary,
                fontWeight: "700",
              }}
            >
              Sign In
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
