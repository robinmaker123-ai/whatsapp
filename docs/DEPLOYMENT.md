# Deployment Guide

## Production topology

- Website: Vercel or Netlify on `videoapp.example`
- Backend API + Socket server: EC2, Render, or VPS on `api.videoapp.example`
- Database: MongoDB Atlas
- Android APK: EAS production build using `mobile/.env.production`

## Required backend environment

Create root `.env` on the server:

```bash
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://prod-user:password@cluster.mongodb.net/videoapp_production
CORS_ORIGINS=https://videoapp.example,https://www.videoapp.example
WEBSITE_URL=https://videoapp.example
WEBSITE_DOMAIN=videoapp.example
API_DOMAIN=api.videoapp.example
JWT_SECRET=replace_with_a_long_random_access_secret
REFRESH_TOKEN_SECRET=replace_with_a_long_random_refresh_secret
ADMIN_JWT_SECRET=replace_with_a_long_random_admin_secret
PHONE_HASH_SECRET=replace_with_a_different_long_random_secret
DOWNLOAD_ADMIN_TOKEN=replace_with_a_release_publish_token
ADMIN_EMAIL=admin@videoapp.example
ADMIN_PASSWORD_HASH=replace_with_generated_password_hash
ENABLE_DEV_OTP_PREVIEW=false
TRUST_PROXY=true
```

## Website deployment

Use these environment variables in your hosting provider:

```bash
VITE_API_URL=/api
VITE_SOCKET_URL=
VITE_BASE_PATH=/
```

Use `VITE_API_URL=/api` only when the website and backend are served from the same public host and the reverse proxy forwards `/api` to the Node server.
For split-host deployments such as GitHub Pages, Netlify, or Vercel plus a separate backend host, set `VITE_API_URL=https://api.videoapp.example/api` instead.
`VITE_API_BASE_URL` is also accepted as a compatibility alias, and the GitHub Pages workflow maps the repository variable `WEBSITE_API_BASE_URL` into both names during the build.

Build command:

```bash
npm run build
```

## Mobile production APK

Set `mobile/.env.production`:

```bash
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=http://65.0.100.186/api
EXPO_PUBLIC_SOCKET_URL=http://65.0.100.186
```

Validate and build:

```bash
npm run validate:release-network --prefix mobile
npm run build:android:apk --prefix mobile
```

The production APK permanently bakes in the public backend URL from `mobile/.env.production`.
`mobile/app.config.js` embeds those values into the Expo manifest so the installed APK still knows the correct backend target after the file itself is excluded from Git and remote workers.

## AWS EC2 deployment

1. Launch an Ubuntu EC2 instance.
2. Open inbound ports `22`, `80`, `443`, and your API port if you are exposing it directly.
3. SSH into the server and install Node.js 22, PM2, and Git:

```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

4. Clone the repository and install dependencies:

```bash
git clone https://github.com/robinmaker123-ai/whatsapp.git
cd whatsapp
npm install
```

5. Create the root `.env` using the backend values above.
6. Start the API with PM2:

```bash
pm2 start backend/src/server.js --name videoapp-api
pm2 save
pm2 startup
```

7. Put Nginx or Caddy in front of the API and point your public host or EC2 IP to the instance.
8. Confirm the backend is live:

```bash
curl http://65.0.100.186/api/health
```

## VPS Docker deployment

1. Create `.env.production` at repo root from `.env.production.example`.
2. Set `PORT=3000` and `API_DOMAIN=api.videoapp.example`.
3. Run:

```bash
cd deploy
docker compose -f docker-compose.vps.yml up -d --build
```

## Verification checklist

- `http://65.0.100.186/api/health` returns JSON
- `http://65.0.100.186/api/health/ready` returns `200`
- Website build points to `/api`
- `mobile/.env.production` points to the public API host
- `npm run verify` passes before release
