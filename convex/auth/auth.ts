import { expo } from "@better-auth/expo";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import authConfig from "../auth.config";

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

// Trusted origins for Better Auth to prevent CORS issues during development
// This includes:
// - Expo Go (exp://)
// - Custom scheme (my-expo-app://)
// - Localhost (for web and Metro dev server)
// - Convex development servers
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
    // Configure Google Sign-In
    socialProviders: {
      google: {
        // @ts-ignore
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        // @ts-ignore
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    plugins: [
      // The Expo and Convex plugins are required
      expo(),
      convex({ authConfig }),
    ],
  });
};
// Example function for getting the current user
export const getCurrentUser = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});

export const clearBetterAuthData = mutation({
  args: {},
  handler: async (ctx) => {
    const deletedUsers = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "user",
        where: [],
      },
      paginationOpts: {
        numItems: 100,
        cursor: null,
      },
    });

    const deletedAccounts = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "account",
        where: [],
      },
      paginationOpts: {
        numItems: 100,
        cursor: null,
      },
    });

    const deletedSessions = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "session",
        where: [],
      },
      paginationOpts: {
        numItems: 100,
        cursor: null,
      },
    });

    return { deletedUsers, deletedAccounts, deletedSessions };
  },
});


