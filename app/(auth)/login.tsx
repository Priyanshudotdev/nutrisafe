import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Linking from "expo-linking";
import { authClient } from "@/lib/auth-client";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  useEffect(() => {
    if (!isSessionPending && session) {
      router.replace("/");
    }
  }, [session, isSessionPending, router]);

  useEffect(() => {
    if (Platform.OS !== "web" && !isExpoGo) {
      try {
        const { GoogleSignin } = require("@react-native-google-signin/google-signin");
        GoogleSignin.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          offlineAccess: false,
        });
      } catch (err) {
        console.warn("Native Google Sign-In module not found in binary:", err);
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web" || isExpoGo) {
        // In Expo Go or Web: use the OAuth in-app browser flow with deep link redirect
        const callbackURL = Linking.createURL("/");
        const { error } = await authClient.signIn.social({
          provider: "google",
          callbackURL,
        });
        if (error) throw new Error(error.message);
      } else {
        // In Custom Development Build: use the native Google dialog
        const { GoogleSignin, statusCodes } = require("@react-native-google-signin/google-signin");
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = await GoogleSignin.signIn();
        const idToken = res.data?.idToken || res.idToken;

        if (!idToken) {
          throw new Error("Failed to retrieve Google ID token.");
        }

        const { error } = await authClient.signIn.social({
          provider: "google",
          idToken,
        });

        if (error) throw new Error(error.message);

        router.replace("/");
      }
    } catch (e: any) {
      if (e?.code === "SIGN_IN_CANCELLED" || e?.code === 12501) {
        // User dismissed the dialog
      } else if (e?.code === "IN_PROGRESS") {
        // Sign-in already underway
      } else {
        Alert.alert("Sign In Failed", e?.message || "An unexpected error occurred during sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: nutriSafeColors.background, justifyContent: "center", paddingHorizontal: spacing.lg }}>
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
        <Text style={{ ...typography.h1, color: nutriSafeColors.onSurface, marginTop: spacing.md }}>
          NutriSafe
        </Text>
        <Text style={{ ...typography.bodyMd, color: nutriSafeColors.onSurfaceVariant, marginTop: 4, textAlign: "center" }}>
          Welcome! Sign in to continue.
        </Text>
      </View>

      <Pressable
        onPress={handleGoogleSignIn}
        disabled={loading}
        style={{
          flexDirection: "row",
          backgroundColor: "#ffffff",
          borderRadius: radii.xl,
          borderWidth: 1.5,
          borderColor: nutriSafeColors.outlineVariant,
          paddingVertical: spacing.md + 4,
          alignItems: "center",
          justifyContent: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Ionicons name="logo-google" size={24} color={nutriSafeColors.onSurface} style={{ marginRight: spacing.sm }} />
        <Text style={{ ...typography.bodyMd, color: nutriSafeColors.onSurface, fontWeight: "700", fontSize: 16 }}>
          {loading ? "Connecting..." : "Continue with Google"}
        </Text>
      </Pressable>
    </View>
  );
}
