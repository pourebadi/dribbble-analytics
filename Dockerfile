FROM node:22-slim

WORKDIR /app

# Install dependencies (scripts must run so better-sqlite3 fetches its prebuild)
COPY package.json package-lock.json ./
RUN npm ci

# Install Chromium + all required system libraries for Playwright
RUN npx playwright install --with-deps chromium

COPY . .

# Build the frontend (vite -> dist/client) and bundle the server (esbuild -> dist/server.cjs)
RUN npm run build

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
