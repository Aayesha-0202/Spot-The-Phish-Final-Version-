# 🐟 Spot the Phish — Full-Stack

A cyber-security phishing-detection training game: a **React + Vite + TypeScript** frontend backed by a **Node.js + Express + TypeScript + MongoDB (Mongoose)** API, fully dockerised.

```
spot-the-phish/
├── frontend/                 # React + Vite + Tailwind UI (the game)
│   ├── src/
│   │   ├── api/              # API client + typed endpoints (gameApi)
│   │   ├── components/       # screens, game cards, ui
│   │   ├── data/             # stimuli library, scoring, performance analysis
│   │   └── store/            # Zustand store (UI state + backend persistence)
│   ├── Dockerfile            # multi-stage build → nginx
│   ├── nginx.conf            # SPA + reverse proxy /api → backend
│   └── vite.config.ts        # dev server + /api proxy
│
├── backend/                  # Express + TypeScript + Mongoose API
│   ├── src/
│   │   ├── config/           # env (zod), db connection, swagger spec
│   │   ├── models/           # Player, GameSession, StimulusAttempt, Analytics
│   │   ├── schemas/          # Zod request validation
│   │   ├── services/         # business logic (DB access)
│   │   ├── controllers/      # request handlers
│   │   ├── routes/           # REST routes
│   │   ├── middleware/       # error handler, rate limiter, validate, notFound
│   │   ├── utils/            # ApiError, asyncHandler, logger, responses
│   │   ├── types/            # shared TS types
│   │   ├── app.ts            # express app (helmet/cors/morgan/rate-limit/docs)
│   │   └── server.ts         # connect DB + listen
│   └── Dockerfile            # multi-stage build → node dist/server.js
│
├── docker-compose.yml        # mongo + backend + frontend
├── .env.example
└── README.md
```

---

## ✅ Prerequisites

- **Docker** + **Docker Compose** (recommended — runs everything)
- *Or, for local dev:* Node.js 20+, and either a local MongoDB or a MongoDB Atlas URI.

---

## 🚀 Quick start (Docker — recommended)

```bash
docker compose up --build
```

This starts three services on a single compose network:

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:3000            |
| Backend  | http://localhost:5000            |
| Mongo    | mongodb://localhost:27017        |
| Swagger  | http://localhost:5000/api/docs   |
| Health   | http://localhost:5000/health     |

The frontend (nginx) reverse-proxies `/api/*` to the backend, so the browser only ever talks to port 3000.

---

## 🛠️ Local development (no Docker)

### 1. Backend

```bash
cd backend
cp .env.example .env          # set MONGO_URI to your local/Atlas MongoDB
npm install
npm run dev                   # tsx watch on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # Vite on http://localhost:3000 (proxies /api → :5000)
```

> The frontend works even if the backend is offline — every persistence call is best-effort and never blocks the UI.

---

## 🔐 Environment variables

### Backend (`backend/.env`)

| Var                  | Default                                | Description                          |
|----------------------|----------------------------------------|--------------------------------------|
| `NODE_ENV`           | `development`                          | `development` / `production` / `test`|
| `PORT`               | `5000`                                 | API port                             |
| `MONGO_URI`          | `mongodb://mongo:27017/spotthephish`   | MongoDB connection string            |
| `CLIENT_ORIGIN`      | `http://localhost:3000`                | Allowed CORS origin                  |
| `RATE_LIMIT_WINDOW_MS` | `900000`                             | Rate-limit window (ms)               |
| `RATE_LIMIT_MAX`     | `300`                                  | Max requests per window per IP       |
| `API_DOCS_PATH`      | `/api/docs`                            | Swagger UI mount path                |

### Frontend (`frontend/.env`)

| Var            | Default | Description                                                         |
|----------------|---------|---------------------------------------------------------------------|
| `VITE_API_BASE`| `/api`  | Base URL for API calls (relative; proxied by Vite/nginx)            |

> Env vars are validated at boot with **Zod** — the backend refuses to start on invalid config.

---

## 🗄️ MongoDB schema

### `players`
| Field       | Type     | Notes                          |
|-------------|----------|--------------------------------|
| `playerId`  | String   | Unique, client-generated UUID  |
| `name`      | String   | 1–40 chars                     |
| `createdAt` | Date     | auto (`timestamps`)            |
| `updatedAt` | Date     | auto (`timestamps`)            |

### `gamesessions`
| Field              | Type     | Notes                                              |
|--------------------|----------|----------------------------------------------------|
| `sessionId`        | String   | Unique, client-generated UUID                      |
| `player`           | ObjectId | → `players`                                        |
| `playerId`         | String   | denormalised for fast lookup                       |
| `status`           | String   | `active` / `completed` / `abandoned`               |
| `startTime`        | Date     |                                                    |
| `endTime`          | Date     | set on finish                                      |
| `totalScore`       | Number   |                                                    |
| `designation`      | String   | e.g. `ELITE HACKER`                                |
| `readinessLevel`   | String   | `LOW`/`MODERATE`/`HIGH`/`ELITE`                    |
| `completedLevels`  | Number   |                                                    |
| `livesRemaining`   | Number   |                                                    |
| `streakAchieved`   | Number   |                                                    |
| `stimuliAttempted` | Number   |                                                    |
| `reportSummary`    | String   |                                                    |
| `createdAt/updatedAt` | Date  | auto                                               |

### `stimulusattempts`
| Field            | Type     | Notes                                              |
|------------------|----------|----------------------------------------------------|
| `sessionId`      | String   |                                                    |
| `session`        | ObjectId | → `gamesessions`                                   |
| `player`/`playerId` |     | → `players`                                        |
| `stimulusId`     | String   | e.g. `g1`                                          |
| `category`       | String   | taxonomy value                                     |
| `tier`           | Number   | 1–5                                                |
| `playerChoice`   | String   |                                                    |
| `correctAnswer`  | Mixed    | ground-truth element map                           |
| `investigations` | Mixed    | the player's per-element investigation             |
| `isCorrect`      | Boolean  |                                                    |
| `scoreAwarded`   | Number   |                                                    |
| `responseTimeMs` | Number   |                                                    |
| `timestamp`      | Date     |                                                    |

### `analytics` (one doc per finished session)
| Field                  | Type   | Notes                                  |
|------------------------|--------|----------------------------------------|
| `sessionId`            | String | Unique                                 |
| `session`/`player`     | ObjectId |                                      |
| `strongestCategory`    | String |                                        |
| `weakestCategory`      | String |                                        |
| `categoryAccuracy`     | Mixed  | `{ category: 0–100 }`                  |
| `tierAccuracy`         | Mixed  | `{ tier: 0–100 }`                      |
| `phishingDetectionRate`| Number | % threats caught                       |
| `falseAlarmRate`       | Number | % safe wrongly flagged                 |
| `compositeScore`       | Number |                                        |
| `designation`/`readinessLevel`/`reportSummary`/`strengths`/`weaknesses`/… | | report snapshot for the share card |

---

## 📡 API reference

Base URL: `/api`. All responses use `{ success, message, data }`. Errors use `{ success: false, message, ... }`.

### Players
| Method | Path                    | Body                                   | Description                  |
|--------|-------------------------|----------------------------------------|------------------------------|
| POST   | `/players`              | `{ playerId, name }`                   | Create/update player (idempotent) |
| GET    | `/players/:playerId`    | —                                      | Get player                   |
| PATCH  | `/players/:playerId`    | `{ name }`                             | Update name                  |

### Sessions
| Method | Path                                  | Body                                       | Description                    |
|--------|---------------------------------------|--------------------------------------------|--------------------------------|
| POST   | `/sessions/start`                     | `{ sessionId, playerId }`                  | Start a session                |
| GET    | `/sessions?playerId=&limit=`          | —                                          | List previous sessions         |
| GET    | `/sessions/:sessionId`                | —                                          | Get a session                  |
| POST   | `/sessions/:sessionId/attempts`       | attempt object                             | Record a completed stimulus    |
| PATCH  | `/sessions/:sessionId/progress`       | progress fields                           | Save in-progress state         |
| POST   | `/sessions/:sessionId/finish`         | final totals                              | Finish the game                |

### Results
| Method | Path                                       | Body            | Description                          |
|--------|--------------------------------------------|-----------------|--------------------------------------|
| POST   | `/sessions/:sessionId/report`              | report object   | Save final report + analytics        |
| GET    | `/sessions/:sessionId/report`              | —               | Fetch report                         |
| GET    | `/sessions/:sessionId/report/download`     | —               | Downloadable share-card metadata     |

### Analytics
| Method | Path                       | Description                |
|--------|----------------------------|----------------------------|
| GET    | `/analytics/overall`       | Cross-session rollup       |
| GET    | `/analytics/categories`    | Per-category accuracy      |
| GET    | `/analytics/tiers`         | Per-tier accuracy          |
| GET    | `/analytics/leaderboard`   | Top scores (`?limit=`)     |

Interactive docs: **http://localhost:5000/api/docs** (Swagger UI).

---

## 🧪 Verifying it works

```bash
# Health
curl http://localhost:5000/health

# Create a player
curl -X POST http://localhost:5000/api/players \
  -H 'Content-Type: application/json' \
  -d '{"playerId":"p_test123","name":"Neo"}'

# Start a session
curl -X POST http://localhost:5000/api/sessions/start \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"s_test1","playerId":"p_test123"}'

# Record an attempt
curl -X POST http://localhost:5000/api/sessions/s_test1/attempts \
  -H 'Content-Type: application/json' \
  -d '{"stimulusId":"g1","category":"E-commerce / Orders","tier":1,"isCorrect":true,"scoreAwarded":10,"responseTimeMs":4200}'

# Leaderboard
curl http://localhost:5000/api/analytics/leaderboard
```

Then play the game at **http://localhost:3000** — every stimulus, score change, level completion and the final report are persisted to MongoDB automatically.

---

## 🧱 Code-quality notes

- **Validation:** every write endpoint validates its body with **Zod** (`src/schemas`).
- **Errors:** centralized `errorHandler` maps Zod/Mongoose/`ApiError` → correct HTTP codes.
- **Security:** `helmet`, `cors` (configured origin), `express-rate-limit`, env-based config.
- **Logging:** `morgan` request logs + a tiny structured logger.
- **Async/await** throughout; modular services/controllers/routes.

---

## 📌 Assumptions

1. **Scoring/performance is computed client-side** (existing `scoring.ts` / `performance.ts`) and sent to the backend, which **validates (Zod) and persists** it. The backend also derives aggregate analytics server-side from stored attempts/sessions.
2. **Client-generated IDs** (`playerId`, `sessionId` as UUIDs) avoid async round-trips and race conditions; the backend enforces uniqueness via indexed fields.
3. **Offline-resilient frontend:** backend calls are fire-and-forget; the game stays fully playable if the API is unreachable.
4. **No auth** layer yet — `playerId` acts as the identity. Swap in JWT/sessions later behind the existing route structure.
5. The downloadable share image is rendered in the browser (Canvas 2D); the `/report/download` endpoint returns the **metadata** that drives it.
