# NutriSafe — "Can I eat this?" answered in seconds

A cross-platform mobile app (Android / iOS / Web from one React Native codebase)
that acts as a personal food-safety gatekeeper for people living with chronic
dietary restrictions — diabetes, chronic kidney disease (CKD), hypertension,
celiac disease, and food allergies.

Photograph food (or type its name) → AI identifies the dish → the app evaluates
it against **your** medical profile → color-coded verdict (**Safe / Moderation /
Not Recommended**) with a per-nutrient breakdown and safer alternatives.
It can also read a **doctor's prescription photo** and apply the extracted
conditions to your health profile.

Full product spec: [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).
UI law: [`DESIGN_RULES.md`](./DESIGN_RULES.md).
Backend docs: [`server/README.md`](./server/README.md).
Beginner setup: [`EASY_SETUP_GUIDE.md`](./EASY_SETUP_GUIDE.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # then add GEMINI_API_KEY (optional but recommended)

pnpm api        # terminal 1 — Express backend on :4000 (SQLite, AI if configured)
pnpm android    # terminal 2 — Expo (or: pnpm ios / pnpm start + scan QR in Expo Go)
```

The client auto-resolves the API host: `localhost` on web, Metro LAN IP on
physical devices, `10.0.2.2` on Android emulators.

| Command                  | What it does                                         |
| ------------------------ | ---------------------------------------------------- |
| `pnpm api`               | Start the backend (`server/index.js`, port 4000)     |
| `pnpm android/ios/start` | Start Expo for a target                              |
| `pnpm typecheck`         | `tsc --noEmit`                                       |
| `pnpm lint`              | ESLint                                               |
| `pnpm test`              | Server AI tests (mocked smoke + e2e, no keys needed) |

## How it works

```
Expo client (src/) ──REST (JSON/multipart)──► Express server (server/:4000)
  app/        expo-router screens                  JWT auth (bcrypt + jsonwebtoken)
  components/ design-system primitives             SQLite persistence (server/data/)
  services/   stores & API clients                 AI layer (server/ai.js):
  data/       local rules engine (foodSafety.ts)     Gemini (default gemini-2.5-flash)
  theme/      light tokens + dark overrides          or any OpenAI-compatible endpoint
```

- **Graceful degradation:** with no AI key, photo ID returns a clear
  `not_configured` state and nutrition checks run through the local
  deterministic rules engine — the app never hard-fails.
- **Multi-condition logic:** each condition contributes factors; the most
  restrictive verdict wins (a food must be safe for _all_ conditions).
- **Dark mode:** system / light / dark (Account → Preferences → Theme); every
  screen resolves colors through `useThemeColors()`.
- **Server env:** plain `node` doesn't inject Expo env, so the server loads
  `.env.local` then `.env` itself (real environment variables always win).

## Environment

| Variable                                              | Required                             | Description                                        |
| ----------------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`                                 | No (default `http://localhost:4000`) | App → API base URL                                 |
| `JWT_SECRET`                                          | **Yes in prod**                      | JWT signing secret                                 |
| `GEMINI_API_KEY`                                      | No                                   | Enables real food recognition + nutrition analysis (fallback) |
| `MUSE_SPARK_API_KEY`                                  | No                                   | Muse Spark key (Meta Model API) — first-match provider        |
| `MUSE_SPARK_MODEL`                                    | No (default `muse-spark-1.3`) | Muse Spark model id (`-contributor` variant for contributor keys) |
| `GEMINI_MODEL`                                        | No (default `gemini-2.5-flash`)      | Gemini model id                                    |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | No                                   | OpenAI-compatible alternative                      |
| `NUTRISAFE_DB_FILE`                                   | No                                   | Override SQLite path                               |
| `NUTRISAFE_SKIP_ENV_FILE`                             | No                                   | `1` disables `.env.local`/`.env` loading (tests)   |

## Adding a medical condition

See the checklist on `PATIENT_CONDITIONS` in `src/data/foodSafety.ts`:
extend the `PatientCondition` union, add a `ConditionMeta`, add a rules branch,
add the short label, and mirror the id in the server's `VALID_CONDITIONS` and
`getConditionColor` in `src/theme/tokens.ts`.

## CI

`.github/workflows/ci.yml` runs typecheck, lint, and both server AI test suites
on every push to `main` and every pull request.
