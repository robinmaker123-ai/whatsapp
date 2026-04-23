# Deployment Guide

## Recommended production topology

- Website: Vercel or Netlify on `videoapp.example`
- Backend API + Socket server: Render or VPS Docker on `api.videoapp.example`
- Database: MongoDB Atlas
- TLS: provider-managed TLS for website, Caddy-managed TLS for VPS backend

## Website

### Netlify

- Root: `website`
- Build command: `npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE_URL=https://api.videoapp.example`
- SPA fallback: already configured in `website/netlify.toml`

### Vercel

- Root: `website`
- Framework: Vite
- Environment: `VITE_API_BASE_URL=https://api.videoapp.example`
- SPA rewrites and headers: already configured in `website/vercel.json`

### GitHub Pages

- Use `.github/workflows/deploy-website.yml`
- Set repository variable `WEBSITE_API_BASE_URL`
- Replace placeholder domain entries in `website/public/sitemap.xml`

## Backend on Render

Use `render.yaml` and set these required secrets:

- `MONGO_URI`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `ADMIN_JWT_SECRET`
- `PHONE_HASH_SECRET`
- `DOWNLOAD_ADMIN_TOKEN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`

Recommended values:

- `NODE_ENV=production`
- `ALLOW_IN_MEMORY_MONGO=false`
- `ENABLE_DEV_OTP_PREVIEW=false`
- `TRUST_PROXY=true`

## Backend on VPS with Docker

1. Create `.env.production` at repo root from `.env.production.example`
2. Set `API_DOMAIN=api.videoapp.example`
3. Run:

```bash
cd deploy
docker compose -f docker-compose.vps.yml up -d --build
```

This launches:

- `videoapp-api`
- `caddy` reverse proxy with automatic HTTPS

## MongoDB Atlas

- Create a dedicated production cluster
- Restrict network access to your backend provider IPs when possible
- Create separate database users for staging and production
- Use the Atlas SRV connection string in `MONGO_URI`

## Admin credentials

Generate the password hash locally:

```bash
npm run admin:hash-password -- "YourStrongPassword"
```

Put the output into `ADMIN_PASSWORD_HASH`.

## Android release publishing

1. Build APK or AAB from `mobile/`
2. Host the signed APK or copy it into `shared/releases/android/`
3. Update metadata:

```bash
npm run release:android -- --version 1.1.0 --build 12 --apk-url https://downloads.example/videoapp.apk --min-supported 10 --notes "Bug fixes|Performance improvements"
```

4. Sync assets:

```bash
npm run sync:shared-assets
```

## Operations checklist

- Set production domains in provider settings
- Confirm CORS allowlist in `CLIENT_URL`
- Confirm admin login works
- Confirm `/health/ready` returns `200`
- Confirm `/site/overview` returns release metadata
- Confirm website download button opens the expected release
- Confirm `npm run verify` passes before each rollout
