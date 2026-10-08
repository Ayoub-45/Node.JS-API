# ---------- Dependencies ----------
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


# ---------- Production image ----------
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Create and use a non-root user
RUN addgroup -S nodejs && \
    adduser -S nodeuser -G nodejs

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY migrations ./migrations
COPY package*.json ./

# Give ownership to the non-root user
RUN chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 3000

CMD ["node", "src/server.js"]
