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
| `GEMINI_MODEL` | No (default `gemini-2.0-flash`) | Gemini model id. |
| `OPENAI_API_KEY` | No | OpenAI-compatible key (OpenAI, OpenRouter, Groq, Ollama, ...). Used if no Gemini key. |
| `OPENAI_BASE_URL` | No (default `https://api.openai.com/v1`) | Base URL for OpenAI-compatible providers. |
| `OPENAI_MODEL` | No (default `gpt-4o-mini`) | Model id for OpenAI-compatible providers. |
| `FOOD_VISION_API_URL` | No | Legacy override: proxy food images to an external vision endpoint instead of the built-in AI layer. |

**AI behavior:** with any provider configured, `/vision/identify` performs real
food-image recognition and `/nutrition/analyze` returns a full structured
analysis (`source: "ai"`). Without a provider, vision returns a clear
`not_configured` state and nutrition returns `source: "local-rules-engine"` so
the app falls back to its built-in deterministic rules engine.

## Data persistence

Accounts and history persist to `server/data/db.json` (gitignored) with atomic
writes. Delete that file to reset all data. For production, swap `store.js`
for a real database (SQLite, Postgres, etc.) — the rest of the server only
touches `load()` / `save()`.

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
