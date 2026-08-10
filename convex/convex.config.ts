import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import { v } from "convex/values";

const app = defineApp({
  env: {
    GEMINI_API_KEY: v.optional(v.string()),
  },
});
app.use(betterAuth);

export default app;
