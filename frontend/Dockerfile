# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Serve with nginx sidecar ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# NOTE: When building from root context (docker-compose), use root Dockerfile instead.
# This Dockerfile is for standalone frontend-only builds.
# Copy sidecar.conf into this directory first, then build with: docker build -f frontend/Dockerfile .
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
