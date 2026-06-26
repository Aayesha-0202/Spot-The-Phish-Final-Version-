# ---- Serve pre-built assets with nginx ----
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy pre-built static assets
COPY dist /usr/share/nginx/html

# Copy nginx config with SPA fallback and reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
