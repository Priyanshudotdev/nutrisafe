import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function IndexScreen() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();

  // Wait for Convex to receive the Better Auth token before querying the profile.
  const profile = useQuery(api.profile.get.get, isAuthenticated ? {} : "skip");

  useEffect(() => {
    // Both auth layers must finish before choosing a route.
    if (isSessionPending || isConvexAuthLoading) return;

    if (!session || !isAuthenticated) {
      router.replace("/(auth)/login");
    } else if (profile === undefined) {
      return;
    } else if (profile === null) {
      router.replace("/(onboarding)/medical-profile");
    } else {
      router.replace("/(tabs)");
    }
  }, [session, isSessionPending, isConvexAuthLoading, isAuthenticated, profile, router]);

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-black">
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );
}
