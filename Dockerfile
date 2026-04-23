FROM node:22-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY shared ./shared
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "backend/src/server.js"]
