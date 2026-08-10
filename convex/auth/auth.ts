import { expo } from "@better-auth/expo";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { v } from "convex/values";
import authConfig from "../auth.config";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

// Expo Go sends an exp:// origin during development. Standalone builds use
// the app's configured my-expo-app:// scheme instead.
const trustedOrigins = [
  "my-expo-app://",
  "exp://",
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://*.convex.cloud",
  "https://*.convex.site",
];

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    trustedOrigins,
    database: authComponent.adapter(ctx),
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // The Expo and Convex plugins are required
      expo(),
      convex({ authConfig }),
    ],
  });
};
// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
