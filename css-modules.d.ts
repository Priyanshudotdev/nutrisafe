// Ambient CSS side-effect imports (e.g. `import "../global.css"`).
// `expo-env.d.ts` normally provides these via `expo/types`, but that file is
// generated (gitignored) — so fresh checkouts (CI) need this fallback.
// Duplicate wildcard declarations merge harmlessly where both exist.
declare module "*.css";
