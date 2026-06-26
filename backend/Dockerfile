FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy all dependencies upfront
COPY package*.json ./
COPY node_modules ./node_modules

# Copy pre-built app
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

EXPOSE 5000
CMD ["node", "dist/server.js"]
