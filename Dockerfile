# Use the official Bun runtime as base image
FROM oven/bun:1-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S bunjs && \
    adduser -S svelte -u 1001

# Set working directory
WORKDIR /app

# Copy built application from base stage
COPY --from=base --chown=svelte:bunjs /app/build ./build
COPY --from=base --chown=svelte:bunjs /app/node_modules ./node_modules
COPY --from=base --chown=svelte:bunjs /app/package.json ./package.json

# Switch to non-root user
USER svelte

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV REDIS_URL=redis://redis:6379

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "require('http').get('http://localhost:3000/api', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "build/index.js"]