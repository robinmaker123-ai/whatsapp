# VideoApp Ecosystem

VideoApp is a WhatsApp-style stack built from three connected parts:

- `src/` is the Node.js + Express + MongoDB + Socket.io backend.
- `mobile/` is the Expo React Native Android client.
- `website/` is the public React marketing and APK download site.

## What is included

- OTP authentication with JWT sessions
- Real-time one-to-one chat with delivery, seen, typing, presence, and media upload
- Status posts with 24-hour expiry and viewer tracking
- Voice and video call records plus signaling flow
- Privacy-first contact sync using local SHA-256 contact hashes
- APK release metadata, tracked download redirects, and app update checks
- Static website pages for Home, Features, Screenshots, Download, and Support

## Repo layout

- `src/` backend source
- `tests/` backend real-time test
- `mobile/` Expo Android app
- `website/` Vite React public website
- `uploads/` uploaded media files in local development

## Backend setup

1. Install root dependencies:

```bash
npm install
```

2. Copy the backend env file:

```bash
copy .env.example .env
```

3. Set at least these values in `.env`:

- `MONGO_URI`
- `JWT_SECRET`
- `PHONE_HASH_SECRET`
- `CLIENT_URL`
- `WEBSITE_URL`

4. Start the backend:

```bash
npm run dev
```

The API starts on `http://localhost:5000` by default.

## Key backend endpoints

### Auth

- `POST /auth/send-otp`
- `POST /auth/verify-otp`

### Users and contacts

- `GET /user/profile`
- `GET /user/chats`
- `GET /users/matched-contacts`
- `POST /users/matched-contacts`
- `POST /users/matched-contacts/sync`

### Messaging and status

- `GET /messages/:userId`
- `POST /messages/send`
- `POST /status`
- `POST /status/upload`

### Calls

- `GET /calls`
- `POST /calls`
- `POST /calls/start`
- `PATCH /calls/:callId`

### Android releases and downloads

- `GET /downloads/latest`
- `GET /downloads/latest.apk`
- `GET /downloads/releases`
- `POST /downloads/releases`

`POST /downloads/releases` requires the admin token from `DOWNLOAD_ADMIN_TOKEN`. Send it with `x-admin-token` or `Authorization: Bearer ...`.

Example release publish request:

```bash
curl -X POST http://localhost:5000/downloads/releases ^
  -H "Content-Type: application/json" ^
  -H "x-admin-token: change_this_to_an_admin_publish_token" ^
  -d "{\"version\":\"1.0.0\",\"buildNumber\":1,\"apkUrl\":\"https://cdn.example.com/videoapp-release.apk\",\"releaseNotes\":[\"Initial release\",\"OTP login\",\"Contact sync\"]}"
```

## Mobile app setup

1. Install Expo dependencies:

```bash
cd mobile
npm install
copy .env.example .env
```

2. Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_SOCKET_URL` to your backend LAN URL.

3. Start the app:

```bash
npm start
```

Useful mobile commands:

```bash
npm run typecheck
npm run prebuild:android
npm run build:android:preview
```

### Mobile behavior

- The app asks for contact permission after sign-in on the Home screen.
- Phone contacts are hashed locally before syncing to the backend.
- Matched contacts appear in the chat and call composer.
- Non-matched contacts show an invite action.
- The app checks `/downloads/latest` for newer Android builds.

## Website setup

1. Install website dependencies:

```bash
cd website
npm install
copy .env.example .env
```

2. Set `VITE_API_BASE_URL` to the backend base URL.

3. Run the site:

```bash
npm run dev
```

4. Build the site:

```bash
npm run build
```

The website uses a `HashRouter`, so the same build can work on GitHub Pages without custom rewrite rules.

## Deploy

### Website

- GitHub Pages: build `website/` and publish `website/dist`
- Netlify: base directory `website`, publish directory `dist`
- Vercel: root directory `website`, framework `Vite`
- VPS: serve `website/dist` with Nginx, Caddy, or Apache

Set `VITE_API_BASE_URL` on the website host so the Download page reads the live release metadata.

### Backend

- Render: deploy the repo root as a Node.js web service
- Railway: deploy the repo root and set the same env vars
- VPS: run `npm install && npm start` behind Nginx or Caddy

Recommended production env values:

- `NODE_ENV=production`
- `CLIENT_URL` with every allowed website origin
- `ENABLE_DEV_OTP_PREVIEW=false`
- `ALLOW_IN_MEMORY_MONGO=false`

### Android

- Build APK/AAB from `mobile/` with EAS
- Upload the APK to your CDN, object storage, or release hosting
- Publish the new APK URL through `POST /downloads/releases`

## Validation

Backend test:

```bash
npm test
```

Mobile type check:

```bash
npm run typecheck:mobile
```

Website build:

```bash
npm run build:website
```
