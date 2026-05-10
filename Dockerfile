# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: dependency install (separate layer for cache efficiency)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Install build tools needed by some native modules (e.g. @azure/cosmos grpc)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy manifests first — layer is cached unless these change
COPY package.json package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: final production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Pull in production node_modules from the deps stage
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application source
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

# Expose the port the app listens on (matches PORT env var default)
EXPOSE 3000

# Health-check — Docker / Azure Container Apps will poll this
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

# Use the production start script
CMD ["node", "server.js"]
