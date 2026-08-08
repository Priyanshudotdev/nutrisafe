import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function IndexScreen() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  
  // Use "skip" if not authenticated yet to avoid unauth errors
  const profile = useQuery(api.profile.get.get, session ? {} : "skip");

  useEffect(() => {
    // Wait for auth to resolve
    if (isPending) return;

    if (!session) {
      // Not authenticated
      router.replace("/(auth)/login");
    } else if (profile === undefined) {
      // Authenticated, but profile query is still loading
      return;
    } else if (profile === null) {
      // Authenticated, but no profile exists
      router.replace("/(onboarding)/medical-profile");
    } else {
      // Authenticated and profile exists
      router.replace("/(tabs)");
    }
  }, [session, isPending, profile, router]);

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-black">
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );
}
