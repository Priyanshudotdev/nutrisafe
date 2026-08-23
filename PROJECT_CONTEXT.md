# NutriCheck — Project Context

> One-liner: **"Can I eat this?" answered in seconds** — NutriCheck scans any food, identifies it with AI, and tells you whether it is safe for *your* medical condition before you take a bite.

---

## 1. What It Is

NutriCheck is a cross-platform mobile app (Android/iOS/Web via one React Native codebase) that acts as a personal food-safety gatekeeper for people living with chronic dietary restrictions — diabetes, chronic kidney disease (CKD), hypertension, celiac disease, and food allergies.

Instead of reading nutrition labels and cross-referencing medical advice manually, the user photographs their food (or types its name), and the app:

1. Identifies the dish from the image using an AI vision model,
2. Evaluates that dish against the user's **personal medical/dietary profile**,
3. Returns a color-coded verdict — **Safe / Moderation / Not Recommended** — with a per-nutrient breakdown explaining *why*.

It also reads **doctor's prescriptions**: photograph an Rx and the app extracts diagnoses/conditions and offers to apply them directly to your health profile.

## 2. The Problem It Solves

| Without NutriCheck | With NutriCheck |
|---|---|
| Guessing whether a dish fits your restrictions | Instant, personalized verdict per dish |
| Reading labels without knowing *your* limits (K? Phos? sugar?) | Per-nutrient factor breakdown tuned to each condition |
| Carrying condition knowledge in your head | Profile captured once — via form **or prescription photo** |
| Generic diet apps that ignore CKD/celiac/allergy overlap | Multi-condition engine where the **most restrictive rule wins** |
| Nutrition info useless without local context | Localized alternatives for Indian foods & regional availability |

The core insight: generic calorie apps answer *"how much?"* — patients need *"is this dangerous **for me**?"*

## 3. User Flow

```
Login/Signup ──► Onboarding wizard ──► Home
                    │   (name, conditions, allergies,
                    │    optional Rx photo scan)
                    ▼
        ┌─── Check Food (type name) ──┐
Home ───┤                             ├──► Analysis result
        └─── Scan Food (photo) ───────┘     (verdict badge +
                │                            nutrient factors +
                └── AI identifies dish       safer alternatives)
                                             │
History ◄──────── every check saved ─────────┘
(search, re-open, delete)
Account ── profile editing, Rx re-scan, theme, notifications, security
```

## 4. Features

### Health profiling
- **5 supported conditions:** Diabetes, Chronic Kidney Disease, Hypertension, Celiac, Food Allergy — multi-select with a primary condition.
- **Prescription scanning (Rx):** photo of a prescription → AI extracts conditions → one-tap apply to profile (during onboarding *and* from Account).
- Allergy specifics free-text (e.g. "Peanuts, Shellfish") plus doctor's notes field.
- Dietary profile lives in a persistent bottom bar on Home for quick edits.

### Food checking
- **Text check:** type a dish name → rules engine evaluates instantly.
- **Photo check:** camera capture or gallery upload → AI vision identifies the dish (with candidate suggestions if unsure) → full analysis.
- Staged progress UX: *Identifying food → Checking nutritional information → Comparing dietary guidelines → Preparing your recommendation.*
- Verdict card: safety badge, per-nutrient factors (each flagged safe/caution/limit), and **safer alternative suggestions** localized to Indian foods/regional availability.

### History & notifications
- Every analysis saved automatically; searchable history with delete.
- In-app notification center (completion events like "History cleared", scan results).
- Empty states with CTAs everywhere data can be absent.

### Account & security
- JWT auth: email/password signup, login, logout, change email/password.
- Settings: theme (system/light/dark), location, in-app notifications toggle, profile fields, security.
- Destructive actions are guarded (clear-history confirmation states count + consequence).

### Design system
- `DESIGN_RULES.md` is the enforced source of truth: clinical teal accent reserved for the primary action, semantic colors only for safety status, fixed 8-tier typography scale, 40/48/52px control heights, shared primitives (`AppButton`, `ErrorBanner`, `ScreenHeader`).

## 5. Architecture

```
┌──────────────────── Expo client (src/) ────────────────┐
│  app/          expo-router screens (tabs, auth, onboard)│
│  components/   design-system primitives + domain cards  │
│  services/     stores & API clients (auth, history,     │
│                vision, analysis, notifications, theme)  │
│  data/         LOCAL rules engine (foodSafety.ts) +     │
│                Indian-food localization                 │
│  theme/        tokens.ts (light) + darkTokens.ts        │
└──────────────────────┬──────────────────────────────────┘
                       │ REST (JSON / multipart)
┌──────────────────────▼──────────────────────────────────┐
│            Express server (server/, port 4000)           │
│  JWT auth + bcrypt │ JSON-file persistence (data/)      │
│  multer uploads    │ AI layer (ai.js):                   │
│    • Google Gemini  OR  OpenAI-compatible endpoint      │
│    • Keys stay server-side only                         │
│  Endpoints: /health, /auth/*, /profile, /onboarding,    │
│   /history*, /vision/identify, /nutrition/analyze,      │
│   /prescription/extract                                 │
└──────────────────────────────────────────────────────────┘
```

**Graceful degradation:** with no AI keys configured, photo identification fails softly and nutrition checks still run through the **local deterministic rules engine** (`evaluateFoodSafetyMulti`) — the app never hard-fails.

**Multi-condition logic:** each condition contributes factors; the final verdict is the most restrictive across all active conditions (a food must be safe for *all* of them).

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Language | TypeScript (strict, JSX-checked) |
| Navigation | expo-router (file-based, typed routes) |
| UI kit | HeroUI Native |
| Styling | Tailwind CSS v4 + uniwind; token-driven `StyleSheet`s |
| State | Custom external stores + `useSyncExternalStore` (no Redux/Zustand) |
| Persistence (client) | AsyncStorage-backed stores |
| Camera/media | expo-image-picker (+ custom web camera fallback) |
| Notifications | expo-notifications |
| Backend | Node.js + Express 5 |
| Auth | bcryptjs password hashing + JWT (jsonwebtoken) |
| Uploads | multer |
| AI | Gemini API or any OpenAI-compatible chat/vision endpoint (server-side only) |
| Persistence (server) | JSON file store in `server/data/` (gitignored) |
| Tooling | pnpm workspaces config, ESLint (expo config), Prettier, tsc |

## 7. Repository Layout

```
nutrisafe/
├── DESIGN_RULES.md        # UI law: colors, type scale, geometry, terminology
├── PROJECT_CONTEXT.md     # this file
├── .env.example           # all env vars documented (client + server + AI)
├── src/
│   ├── app/               # routes: (tabs)/{index,scan,search,account},
│   │                      #         login, signup, onboarding
│   ├── components/        # AppButton, ScreenHeader, ErrorBanner,
│   │                      # FoodCheckCard, SafetyStatusBadge, ConditionSelector,
│   │                      # DietaryProfileBar, StepProgressState, ...
│   ├── services/          # apiClient, authService/authStore, historyService,
│   │                      # foodVision, foodAnalysis, prescriptionVision,
│   │                      # sessionSync, notificationStore, themeStore
│   ├── data/              # foodSafety.ts (rules engine + demo seed),
│   │                      # indianFoods.ts (localized alternatives)
│   ├── hooks/             # useTheme, useThemeColors
│   ├── theme/             # tokens.ts, darkTokens.ts
│   └── config/api.ts      # smart base-URL resolution (device/emulator/web)
└── server/                # index.js (API), store.js (persistence),
    ├── ai.js              # provider abstraction + tests
                           # README.md
```

## 8. Running It

```bash
pnpm install
pnpm api        # terminal 1 – Express backend on :4000
pnpm android    # terminal 2 – Expo dev client / emulator (or ios / web)
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint .
cp .env.example .env.local   # then add GEMINI_API_KEY or OPENAI_API_KEY (optional)
```

The client auto-resolves the API host: `localhost` on web, Metro LAN IP on physical devices, `10.0.2.2` on Android emulators — no manual URL juggling.

## 9. Known Limitations / Roadmap

- Dark mode themes tab chrome today; screen surfaces still read light tokens (`darkTokens.ts` exists, wiring pending).
- Server persistence is a JSON file store — fine for dev, swap for a real DB before scale.
- Rules engine covers the 5 modeled conditions; new conditions require adding `ConditionMeta` + factors.
- `app.json` name/slug still carry template values ("my-app").
- No automated CI; smoke/e2e scripts exist only for the AI layer (`server/ai.*-test.js`).
