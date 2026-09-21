# NutriSafe — local API server

## Start

```bash
node server/index.js
# or
pnpm api
```

Defaults to **http://localhost:4000**. Set `PORT` to change.

## Environment variables

| Variable                  | Required                                 | Description                                                                                         |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`                    | No (default 4000)                        | Server port                                                                                         |
| `JWT_SECRET`              | **Yes in prod**                          | Secret used to sign JWTs. Change from default.                                                      |
| `GEMINI_API_KEY`          | No                                       | Google Gemini key — enables AI food identification + nutrition analysis.                            |
| `MUSE_SPARK_API_KEY`      | No                                       | Muse Spark key (Meta Model API, `LLM\|...`) — first-match provider when set.                      |
| `MUSE_SPARK_MODEL`        | No (default `muse-spark-1.3-contributor`)| Muse Spark model id.                                                                              |
| `MUSE_SPARK_BASE_URL`     | No (default `https://api.meta.ai/v1`)    | Meta Model API base URL.                                                                          |
| `GEMINI_MODEL`            | No (default `gemini-2.5-flash`)          | Gemini model id.                                                                                    |
| `OPENAI_API_KEY`          | No                                       | OpenAI-compatible key (OpenAI, OpenRouter, Groq, Ollama, ...). Used if no Gemini key.               |
| `OPENAI_BASE_URL`         | No (default `https://api.openai.com/v1`) | Base URL for OpenAI-compatible providers.                                                           |
| `OPENAI_MODEL`            | No (default `gpt-4o-mini`)               | Model id for OpenAI-compatible providers.                                                           |
| `FOOD_VISION_API_URL`     | No                                       | Legacy override: proxy food images to an external vision endpoint instead of the built-in AI layer. |
| `NUTRISAFE_DB_FILE`       | No                                       | Override the SQLite database path (tests use a temp file).                                          |
| `NUTRISAFE_SKIP_ENV_FILE` | No                                       | Set to `1` to skip `.env.local`/`.env` loading (hermetic tests).                                    |
| `CORS_ORIGINS`            | No                                       | Comma-separated allowed origins. Defaults to open (dev); set in production.                         |

> Plain `node` doesn't inject Expo env, so the server loads `.env.local` then
> `.env` from the project root itself. Real environment variables always win.

**AI behavior:** with any provider configured, `/vision/identify` performs real
food-image recognition and `/nutrition/analyze` returns a full structured
analysis (`source: "ai"`). Gemini calls go through the official
`@google/genai` SDK (camelCase `inlineData`, `systemInstruction`); OpenAI
uses the chat-completions REST API. Without a provider, vision returns a clear
`not_configured` state and nutrition returns `source: "local-rules-engine"` so
the app falls back to its built-in deterministic rules engine.

## Data persistence

Accounts and history persist to SQLite at `server/data/nutrisafe.db` (gitignored,
zero dependencies via Node's built-in `node:sqlite`). History is capped at 500
entries per user (oldest trimmed on save). A legacy `db.json`, if
present, is migrated automatically on first boot and renamed to
`db.json.migrated`. Set `NUTRISAFE_DB_FILE` to override the path, or delete the
`.db` file to reset all data. The server only touches `store.js` `load()` /
`save()`, so swapping in Postgres later is a one-module change. For production,
also set a real `JWT_SECRET`.

## Endpoints

### Auth

| Method | Path                    | Auth   | Description                    |
| ------ | ----------------------- | ------ | ------------------------------ |
| `POST` | `/auth/signup`          | —      | Create account                 |
| `POST` | `/auth/login`           | —      | Login, returns JWT             |
| `POST` | `/auth/logout`          | Bearer | Logout (client discards token) |
| `POST` | `/auth/change-password` | Bearer | Change password                |
| `POST` | `/auth/change-email`    | Bearer | Change email                   |

### Profile

| Method  | Path       | Auth   | Description           |
| ------- | ---------- | ------ | --------------------- |
| `GET`   | `/profile` | Bearer | Fetch profile         |
| `PATCH` | `/profile` | Bearer | Update profile fields |

### History

| Method   | Path           | Auth   | Description                                               |
| -------- | -------------- | ------ | --------------------------------------------------------- |
| `GET`    | `/history`     | Bearer | Get food checks (`?limit=1..500`, default 200)            |
| `POST`   | `/history`     | Bearer | Save a food check (validated: id/foodName/status, ≤100KB) |
| `DELETE` | `/history/:id` | Bearer | Delete one food check                                     |
| `DELETE` | `/history`     | Bearer | Clear all history                                         |

### Vision & Nutrition (AI)

| Method | Path                 | Auth   | Description                                                                                              |
| ------ | -------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`            | —      | Status + configured AI provider                                                                          |
| `POST` | `/vision/identify`   | Bearer | multipart `image` → `{ status, foodName, confidence, candidates? }` (legacy fallback) |
| `POST` | `/vision/identify-json` | Bearer | JSON `{ imageBase64, mime }` → same shape (preferred mobile path)              |
| `POST` | `/prescription/extract` | Bearer | multipart `image` → extraction result (legacy fallback)                        |
| `POST` | `/prescription/extract-json` | Bearer | JSON `{ imageBase64, mime }` → same shape (preferred mobile path)         |
| `POST` | `/nutrition/analyze` | Bearer | `{ foodName, condition, patient? }` → `{ source: "ai", analysis }` or `{ source: "local-rules-engine" }` |

Valid conditions: `diabetes`, `ckd`, `hypertension`, `celiac`, `allergy`.
