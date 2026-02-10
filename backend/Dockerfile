FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
RUN npx playwright install --with-deps chromium

COPY backend/src/ ./src/

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
