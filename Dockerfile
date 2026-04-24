FROM node:22-alpine AS website-builder

WORKDIR /app

COPY website/package*.json ./website/
RUN npm ci --prefix website

COPY website ./website
COPY shared ./shared
COPY scripts ./scripts

RUN node scripts/sync-shared-assets.js && npm run build --prefix website

FROM node:22-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY shared ./shared
COPY scripts ./scripts
COPY --from=website-builder /app/website/dist ./website/dist

ENV NODE_ENV=production
EXPOSE 5173

CMD ["node", "backend/src/server.js"]
