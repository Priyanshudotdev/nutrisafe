# NutriCheck — local API server

## Start

```bash
node server/index.js
# or
pnpm api
```

Defaults to **http://localhost:4000**. Set `PORT` to change.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 4000) | Server port |
| `JWT_SECRET` | **Yes in prod** | Secret used to sign JWTs. Change from default. |
| `GEMINI_API_KEY` | No | Google Gemini key — enables AI food identification + nutrition analysis. |
| `GEMINI_MODEL` | No (default `gemini-3.5-flash`) | Gemini model id. |
| `OPENAI_API_KEY` | No | OpenAI-compatible key (OpenAI, OpenRouter, Groq, Ollama, ...). Used if no Gemini key. |
| `OPENAI_BASE_URL` | No (default `https://api.openai.com/v1`) | Base URL for OpenAI-compatible providers. |
| `OPENAI_MODEL` | No (default `gpt-4o-mini`) | Model id for OpenAI-compatible providers. |
| `FOOD_VISION_API_URL` | No | Legacy override: proxy food images to an external vision endpoint instead of the built-in AI layer. |
| `NUTRICHECK_DB_FILE` | No | Override the SQLite database path (tests use a temp file). |
| `NUTRICHECK_SKIP_ENV_FILE` | No | Set to `1` to skip `.env.local`/`.env` loading (hermetic tests). |

> Plain `node` doesn't inject Expo env, so the server loads `.env.local` then
> `.env` from the project root itself. Real environment variables always win.

**AI behavior:** with any provider configured, `/vision/identify` performs real
food-image recognition and `/nutrition/analyze` returns a full structured
analysis (`source: "ai"`). Without a provider, vision returns a clear
`not_configured` state and nutrition returns `source: "local-rules-engine"` so
the app falls back to its built-in deterministic rules engine.

## Data persistence

Accounts and history persist to SQLite at `server/data/nutricheck.db` (gitignored,
zero dependencies via Node's built-in `node:sqlite`). A legacy `db.json`, if
present, is migrated automatically on first boot and renamed to
`db.json.migrated`. Set `NUTRICHECK_DB_FILE` to override the path, or delete the
`.db` file to reset all data. The server only touches `store.js` `load()` /
`save()`, so swapping in Postgres later is a one-module change. For production,
also set a real `JWT_SECRET`.

## Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | — | Create account |
| `POST` | `/auth/login` | — | Login, returns JWT |
| `POST` | `/auth/logout` | Bearer | Logout (client discards token) |
| `POST` | `/auth/change-password` | Bearer | Change password |
| `POST` | `/auth/change-email` | Bearer | Change email |

### Profile
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/profile` | Bearer | Fetch profile |
| `PATCH` | `/profile` | Bearer | Update profile fields |

### History
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/history` | Bearer | Get all food checks |
| `POST` | `/history` | Bearer | Save a food check |
| `DELETE` | `/history` | Bearer | Clear all history |

### Vision & Nutrition (AI)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Status + configured AI provider |
| `POST` | `/vision/identify` | Bearer | multipart `image` → `{ status, foodName, confidence, candidates? }` |
| `POST` | `/nutrition/analyze` | Bearer | `{ foodName, condition, patient? }` → `{ source: "ai", analysis }` or `{ source: "local-rules-engine" }` |

Valid conditions: `diabetes`, `ckd`, `hypertension`, `celiac`, `allergy`.
