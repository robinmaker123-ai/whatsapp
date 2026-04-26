# VideoApp Mobile

Expo React Native Android client for the VideoApp backend.

## Environment files

- `mobile/.env.development`
- `mobile/.env.production`

Variables:

```bash
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=http://65.0.100.186/api
EXPO_PUBLIC_SOCKET_URL=http://65.0.100.186
```

Use a development or staging API in `mobile/.env.development`.
Use the permanent public API in `mobile/.env.production`.
`mobile/app.config.js` now embeds those public URLs into the APK, so the installed app keeps the correct backend target even when the remote EAS worker cannot read your ignored local env files directly.

## Development

```bash
npm install
npm start
```

The app reads `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` from `mobile/.env.development` while running in development mode.

## Production APK

Validate the production backend before building:

```bash
npm run validate:release-network
```

Build a production APK that permanently targets the public backend from `mobile/.env.production`:

```bash
npm run build:android:apk
```

If `/health` does not return backend JSON, the build is blocked.
If you prefer running `eas build -p android --profile production` directly, keep `mobile/.env.production` present locally so `mobile/app.config.js` can embed the same URLs into the release build.
