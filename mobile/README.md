# VideoApp Mobile

Expo React Native Android client for the VideoApp backend in the repo root.

## Highlights

- OTP sign in
- Private contact sync with local phone hashing
- Matched contacts plus invite suggestions
- Real-time chat with media, typing, presence, and seen states
- Status creation and viewing
- Call history and signaling flow
- Update checker for the latest APK release

## Setup

1. Install dependencies and create the mobile env file:

```bash
npm install
copy .env.example .env
```

2. Set your backend LAN URL in `mobile/.env` for development:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:5173
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.20:5173
EXPO_PUBLIC_BACKEND_PORT=5173
```

3. For release APK builds, also set a public backend URL:

```bash
EXPO_PUBLIC_PRODUCTION_API_BASE_URL=https://api.videoapp.example
EXPO_PUBLIC_PRODUCTION_SOCKET_URL=https://api.videoapp.example
```

The release URL must be the real VideoApp API, not the website/dev server. `npm run build:android:apk` now validates `${EXPO_PUBLIC_PRODUCTION_API_BASE_URL}/health` before creating the build.

4. Start Expo:

```bash
npm start
```

## Android build commands

```bash
npm run typecheck
npm run prebuild:android
npm run build:android:preview
```

## Notes

- Use your real LAN IP instead of `localhost`, `127.0.0.1`, or `10.0.2.2`.
- Release APKs should never be built with a private `172.x`, `192.168.x`, `10.x`, or `localhost` backend URL. Use the `EXPO_PUBLIC_PRODUCTION_*` variables for public builds.
- Release APKs should point to the API service itself. If `/health` returns HTML or a website page, the URL is wrong and the build should be blocked.
- The app requests contact permission after sign-in so it can match saved numbers with registered users.
- When `ENABLE_DEV_OTP_PREVIEW=true` on the backend, the login screen shows the development OTP. Keep it `false` in production.
