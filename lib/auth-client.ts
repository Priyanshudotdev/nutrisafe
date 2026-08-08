import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  plugins: [
    // @ts-expect-error BetterAuth TS generic mismatch with Expo client plugin
    expoClient({
      scheme: Constants.expoConfig?.scheme ?? "my-expo-app",
      storagePrefix: Constants.expoConfig?.scheme ?? "my-expo-app",
      storage: SecureStore,
    }),
    convexClient(),
  ],
});
