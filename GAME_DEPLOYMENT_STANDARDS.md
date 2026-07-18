# Game Deployment Standards

**Author:** Pranav  
**Scope:** VM2 Game Deployment Layer  
**Purpose:** Define the adaptations every game must make so it deploys smoothly behind the shared outer nginx without operational friction or security gaps.

---

## 1. Architecture overview

Each game runs as an isolated Docker Compose project on the **game VM**. Shared data services (Postgres, Mongo, Redis, Minio) run on a separate **omnideck backend VM** in GCP. The platform provides one shared entrypoint on the game VM: `outer-nginx`. Every game exposes exactly one entrypoint to the platform: its **sidecar nginx**.

```
User request
    │
    ▼
outer-nginx (shared, game VM)
    │
    ├─► Host: game1.local ─────► game1-sidecar ──► game1-backend / static files
    ├─► Host: game2.local ─────► game2-sidecar ──► game2-backend / static files
    └─► Path: /gameN/ ─────────► gameN-sidecar ──► gameN-backend / static files
                              │
                              ▼
                    omnideck backend VM
                    (Postgres, Mongo, Redis, Minio)
```

**Golden rule:** The outer nginx knows only the sidecar name. It never serves game files directly and never proxies to backends, workers, or databases.

**Two-VM rule:** Games never host their own databases. They connect to the shared backend VM over the GCP network using the endpoint supplied by the platform team.

---

## 2. Where frontend files are served

Games built with Vite, React, or Next.js must be **exported to static files** and served by the game's own sidecar nginx.

**Do not** serve static files from the outer nginx. The outer nginx is shared infrastructure and must remain game-agnostic.

**Recommended placement:** the sidecar nginx serves the built `dist/` or `out/` folder and proxies API calls to the game's backend.

**When to add an internal nginx:** only if your game has multiple worker backends behind a load balancer (Pattern B). In that case the internal nginx load-balances workers, and the sidecar serves static files plus proxies `/api` to the internal nginx. For most games, the sidecar alone is sufficient.

---

## 3. Required project structure

```
<game-name>/
├── docker-compose.yml
├── Dockerfile              # optional but recommended for frontend builds
├── sidecar.conf
├── outer-game.conf
└── (source code / build context)
```

Directory and container names must match the game name exactly. Examples: `tetris/`, `wordle/`, `racing/`.

---

## 4. Container naming convention

Every `container_name` must be prefixed with the game name.

✅ Correct:

```yaml
container_name: tetris-sidecar
container_name: tetris-backend
container_name: tetris-worker1
```

❌ Incorrect:

```yaml
container_name: sidecar
container_name: backend
container_name: nginx
container_name: app
```

Generic names collide across games and will prevent deployment.

---

## 5. Network rules

Each game uses two networks:

1. `games_proxy` — external, shared. **Only the sidecar joins this network.**
2. `<game-name>_net` — private bridge. All other services join only this network.

✅ Correct:

```yaml
services:
  tetris-sidecar:
    container_name: tetris-sidecar
    networks:
      - games_proxy
      - tetris_net

  tetris-backend:
    container_name: tetris-backend
    networks:
      - tetris_net

networks:
  games_proxy:
    external: true
  tetris_net:
    driver: bridge
```

❌ Incorrect:

```yaml
  tetris-backend:
    networks:
      - games_proxy    # NEVER
      - tetris_net
```

Backends on `games_proxy` can be reached by other games. This violates isolation.

---

## 5.1 Connecting to shared data stores

The platform provides shared Postgres, Mongo, Redis, and Minio instances on the **omnideck backend VM**. Your game VM connects to that VM over the GCP network. The platform team will supply the endpoint, first as a **static IP** and later as a **subdomain** (for example `db.omnideck.example.com`).

### Production connection

Read every connection value from environment variables. Do not hard-code credentials in source code.

```yaml
services:
  tetris-backend:
    environment:
      - POSTGRES_HOST=${POSTGRES_HOST}
      - POSTGRES_PORT=${POSTGRES_PORT}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
```

Example `.env` for the static-IP phase:

```bash
POSTGRES_HOST=34.120.45.67
POSTGRES_PORT=5432
POSTGRES_USER=newproj
POSTGRES_PASSWORD=...
POSTGRES_DB=game_newproj
```

Example `.env` for the subdomain phase:

```bash
POSTGRES_HOST=postgres.omnideck.example.com
POSTGRES_PORT=5432
POSTGRES_USER=newproj
POSTGRES_PASSWORD=...
POSTGRES_DB=game_newproj
```

Apply the same pattern for Mongo, Redis, and Minio. Redis keys must still be prefixed with your game identifier, and S3 buckets must still be scoped to your game.

### Local development only

On a local laptop, Docker Desktop users can reach a locally running data store with `host.docker.internal`. This is only for local testing; production deployments always use the backend VM endpoint supplied by the platform team.

### Network assumptions

- Do not publish data-store ports from the game VM.
- Do not run a data store inside a game container.
- Firewall rules between the game VM and backend VM are managed by the platform team. If a connection fails, verify the supplied endpoint and port before changing game code.

---

## 6. No host ports

Do not publish host ports from any service except for local debugging, and remove them before deployment.

❌ Incorrect:

```yaml
  tetris-backend:
    ports:
      - "3000:3000"
```

Host ports conflict with other games and with services already running on the VM.

---

## 7. Resource limits

Add memory limits to every service.

| Service | Suggested limit |
|---------|-----------------|
| Sidecar nginx | 20–50 MB |
| Backend (Node/Python/Go) | 128–512 MB |
| Worker | 128–256 MB |
| Internal nginx (Pattern B) | 50 MB |

Example:

```yaml
    deploy:
      resources:
        limits:
          memory: 128M
```

---

## 8. Frontend build instructions

### 8.1 Vite / React

Build command:

```bash
npm run build
```

Output folder: `dist/`

### 8.2 Next.js — choose one of two patterns

#### Pattern A: static export (recommended for simple games)

Configure static export in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
}
module.exports = nextConfig
```

Build command:

```bash
npm run build
```

Output folder: `dist/`

Limitations: API routes, SSR, middleware, and rewrites are not available. Put APIs in a separate backend (e.g., Express) and proxy `/api` from the sidecar.

#### Pattern B: Next.js server (when you need SSR or API routes)

Do not use `output: 'export'`. Build the app and run `next start` inside the container. The sidecar proxies **all** traffic to the Next.js container.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
```

Sidecar:

```nginx
location / {
    proxy_pass http://<game-name>-app:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Trade-off: larger image, higher memory usage (allocate 256 MB or more), but full Next.js features work.

---

## 9. Serving the frontend from the sidecar

Use a multi-stage Dockerfile or a bind-mount. The multi-stage Dockerfile is preferred because the build is reproducible and the artifact is self-contained.

### Option A: Multi-stage Dockerfile (preferred)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY sidecar.conf /etc/nginx/nginx.conf
```

`docker-compose.yml`:

```yaml
services:
  tetris-sidecar:
    container_name: tetris-sidecar
    build:
      context: .
      dockerfile: Dockerfile
    networks:
      - games_proxy
      - tetris_net
    deploy:
      resources:
        limits:
          memory: 50M
    restart: unless-stopped
```

### Option B: Pre-built files mounted into nginx

If the build is performed outside Docker:

```yaml
services:
  tetris-sidecar:
    container_name: tetris-sidecar
    image: nginx:alpine
    volumes:
      - ./sidecar.conf:/etc/nginx/nginx.conf:ro
      - ./dist:/usr/share/nginx/html:ro
    networks:
      - games_proxy
      - tetris_net
    deploy:
      resources:
        limits:
          memory: 50M
    restart: unless-stopped
```

---

## 10. `sidecar.conf` for static frontend + API backend

```nginx
events { worker_connections 64; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;

        # Static frontend files
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        # API proxy (only if your game has a backend)
        location /api/ {
            proxy_pass http://<game-name>-backend:<port>/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

Replace `<game-name>` and `<port>` with your values. Remove the `/api/` block if your game has no backend.

⚠️ **Always keep the trailing slash in `proxy_pass`.** `proxy_pass http://target:80/;` is correct. `proxy_pass http://target:80;` causes path mangling.

---

## 11. `outer-game.conf`

This file tells the shared outer nginx how to reach your sidecar. Provide **one server block** for Host-header routing.

```nginx
server {
    listen 80;
    server_name <game-name>.local;

    location / {
        proxy_pass http://<game-name>-sidecar:80/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Replace `<game-name>` in both places. Do not put `location` blocks outside the `server` block.

Path-prefix routing (e.g., `/<game-name>/`) is handled by the platform's default server. If you require it, coordinate the path-prefix entry separately.

---

## 12. Healthchecks

Every backend or worker service must have a healthcheck. Without it, a dead backend causes the sidecar to hang requests until the proxy timeout.

Example:

```yaml
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Your backend must expose `/health` and return HTTP 200 when healthy.

---

## 13. Validation checklist

Before your game is considered deployable, verify every item:

- [ ] Directory and all container names are prefixed with the game name.
- [ ] `docker-compose.yml`, `sidecar.conf`, and `outer-game.conf` are present.
- [ ] Only the sidecar service joins `games_proxy`.
- [ ] No service publishes host ports.
- [ ] Memory limits are set on every service.
- [ ] Database credentials and host are read from environment variables.
- [ ] Frontend builds to static files (`dist/` or `out/`).
- [ ] Sidecar serves static files and proxies `/api/` with a trailing slash.
- [ ] `outer-game.conf` has one valid server block with `server_name <game>.local`.
- [ ] Healthchecks are configured for backends/workers.
- [ ] `docker compose up -d` starts cleanly.
- [ ] `docker exec <game>-sidecar nginx -t` passes.
- [ ] Backend `/health` returns 200.
- [ ] Local test with a temporary host port returns 200.
- [ ] No `version:` field in `docker-compose.yml`.

---

## 14. Common deployment-blocking mistakes

| Mistake | Consequence |
|---------|-------------|
| Generic container names | Name collision; deployment fails |
| Backend on `games_proxy` | Network isolation broken; other games can reach it |
| Host ports in compose | Port conflicts; security exposure |
| Missing trailing slash in `proxy_pass` | Path mangling, 404s, broken API calls |
| `location` outside `server` block | Nginx syntax error; outer nginx cannot reload |
| No healthcheck | Dead backends hang requests instead of failing fast |
| No memory limits | Runaway container can destabilize the VM |
| Invalid `outer-game.conf` | One bad game can block reloads for all games |
| Serving frontend from outer nginx | Outer nginx becomes game-aware; violates architecture |
| Next.js without choosing a pattern | Static export ignores API routes; server pattern needs more memory |
| Hard-coded database credentials | Security risk; makes rotation impossible |
| `host.docker.internal` in production | Game VM cannot reach the backend VM; use the supplied IP or subdomain |
| Running a database inside a game container | Wastes VM resources; breaks the shared-store architecture |
| Obsolete `version: "3.8"` in compose | Harmless warning, but remove it to keep files clean |

---

## 15. Complete example: Vite + backend

### Project layout

```
tetris/
├── docker-compose.yml
├── Dockerfile
├── sidecar.conf
├── outer-game.conf
├── package.json
└── src/
```

### `docker-compose.yml`

```yaml
services:
  tetris-sidecar:
    container_name: tetris-sidecar
    build:
      context: .
      dockerfile: Dockerfile
    networks:
      - games_proxy
      - tetris_net
    deploy:
      resources:
        limits:
          memory: 50M
    restart: unless-stopped

  tetris-backend:
    container_name: tetris-backend
    build:
      context: ./api
      dockerfile: Dockerfile
    networks:
      - tetris_net
    env_file:
      - .env
    deploy:
      resources:
        limits:
          memory: 128M
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    restart: unless-stopped

networks:
  games_proxy:
    external: true
  tetris_net:
    driver: bridge
```

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY sidecar.conf /etc/nginx/nginx.conf
```

### `sidecar.conf`

```nginx
events { worker_connections 64; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;

        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://tetris-backend:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### `outer-game.conf`

```nginx
server {
    listen 80;
    server_name tetris.local;

    location / {
        proxy_pass http://tetris-sidecar:80/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 16. Local testing

Map the sidecar to a temporary host port for local verification only:

```yaml
services:
  tetris-sidecar:
    ports:
      - "18080:80"
```

Test:

```bash
docker compose up -d
curl -H "Host: tetris.local" http://localhost:18080/
curl -H "Host: tetris.local" http://localhost:18080/api/health
```

Remove the `ports:` block before the game is deployed.

---

*Document version 1.1 — Pranav*
