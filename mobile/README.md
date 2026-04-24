# VideoApp Mobile

Expo React Native Android client for the VideoApp backend.

## Environment files

- `mobile/.env.development`
- `mobile/.env.production`

Variables:

```bash
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://api.videoapp.example
EXPO_PUBLIC_SOCKET_URL=https://api.videoapp.example
```

Use a development or staging API in `mobile/.env.development`.
Use the permanent public API in `mobile/.env.production`.

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
eas build -p android --profile production
```

If `/health` does not return backend JSON, the build is blocked.
