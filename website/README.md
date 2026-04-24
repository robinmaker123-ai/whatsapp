# VideoApp Website

Public Vite + React website for landing pages, APK downloads, updates, and admin access.

## Environment files

- `website/.env.development`
- `website/.env.production`

Variables:

```bash
VITE_API_URL=https://api.videoapp.example
VITE_SOCKET_URL=https://api.videoapp.example
VITE_BASE_PATH=/
```

## Local run

1. Review `website/.env.development` and point it at your development or staging API.
2. Install dependencies and start Vite:

```bash
npm install
npm run dev
```

The website dev server runs on port `4173`.

## Production build

1. Set `VITE_API_URL` and `VITE_SOCKET_URL` in `website/.env.production` or your hosting provider.
2. Build the site:

```bash
npm run build
```

Use the real backend API URL here, not the public website URL.
