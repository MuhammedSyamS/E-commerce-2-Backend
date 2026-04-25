# PHASE 1: BUILD
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# If Next.js frontend is inside, build it here
# RUN npm run build

# PHASE 2: PRODUCTION
FROM node:20-alpine AS runner
WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nodejs -G nodejs
USER nodejs

ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Resource Limits & Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node scripts/healthcheck.js

EXPOSE 5005
CMD ["node", "index.js"]
