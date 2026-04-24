# VideoApp Monorepo

VideoApp is now structured as a production-minded monorepo:

- `backend/` Node.js + Express + MongoDB + Socket.io API
- `mobile/` Expo React Native Android client
- `website/` public marketing site, release surface, and admin dashboard
- `shared/` shared product copy and Android release metadata
- `deploy/` VPS + Docker + Caddy deployment assets

## What changed in this phase

- Production-ready backend auth with access tokens, refresh tokens, and device sessions
- Admin dashboard APIs for stats, reports, user bans, announcements, releases, and log viewing
- Public website upgrades for live download counts, testimonials, FAQ, updates page, and SEO
- Android release metadata workflow with changelog and minimum supported build handling
- Security hardening with rate limiting, stricter uploads, session revocation, and structured logs
- Docker + reverse-proxy deployment scaffolding plus CI and release workflows

## Local setup

1. Install dependencies:

```bash
npm install
npm install --prefix website
npm install --prefix mobile
```

2. Configure environment files:

```bash
copy .env.example .env
```

Then review:

- `website/.env.development`
- `website/.env.production`
- `mobile/.env.development`
- `mobile/.env.production`

3. Start the backend and website:

```bash
npm run dev:backend
npm run dev:website
```

The backend now expects a real MongoDB instance from `MONGO_URI` and defaults to port `5001`.

4. Start the mobile app:

```bash
npm run dev:mobile
```

## Environment layering

The backend now loads environment files in this order:

1. `.env`
2. `.env.<NODE_ENV>`
3. `.env.local`
4. `.env.<NODE_ENV>.local`

Example templates are included for:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

## Admin dashboard

Website routes:

- `/` public landing page
- `/updates` product updates and release notes
- `/admin/login` admin login
- `/admin` admin dashboard

Admin auth uses:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_JWT_SECRET`

Generate a password hash:

```bash
npm run admin:hash-password -- "YourStrongPassword"
```

## Android release flow

Update release metadata:

```bash
npm run release:android -- --version 1.1.0 --build 12 --apk-url https://example.com/videoapp.apk --min-supported 10 --notes "Security hardening|Admin dashboard|Force update support"
```

Then sync the shared assets into the website:

```bash
npm run sync:shared-assets
```

Build Android artifacts:

```bash
npm run build:android:apk --prefix mobile
npm run build:android:aab --prefix mobile
```

Direct EAS production APK command:

```bash
eas build -p android --profile production
```

## Deployment targets

- Website: GitHub Pages, Netlify, or Vercel
- Backend: Render, Railway, or VPS Docker deployment
- Database: MongoDB Atlas

Included deployment assets:

- `render.yaml`
- `website/netlify.toml`
- `website/vercel.json`
- `deploy/docker-compose.vps.yml`
- `deploy/Caddyfile`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-website.yml`
- `.github/workflows/android-release.yml`

## Backend process manager

Run the API with PM2:

```bash
npm run start:backend:pm2
```

## Verification

Run the full verification suite:

```bash
npm run verify
```

That currently runs:

- backend tests
- mobile TypeScript checks
- website production build

## Notes

- Replace placeholder domains in `website/public/sitemap.xml` before production rollout.
- Add a real signed APK to `shared/releases/android/` if you want the website to serve the file directly.
- For public launch, store all production secrets in the hosting provider, not in committed `.env` files.
