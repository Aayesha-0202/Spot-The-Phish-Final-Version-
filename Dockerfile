# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ . .
RUN npm run build

# ---- Stage 2: Serve with nginx sidecar ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY sidecar.conf /etc/nginx/nginx.conf
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
