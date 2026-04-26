# VideoApp Website

Public Vite + React website for landing pages, APK downloads, updates, and admin access.

## Environment files

- `website/.env.development`
- `website/.env.production`

Variables:

```bash
VITE_API_URL=/api
VITE_SOCKET_URL=
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

1. Set `VITE_API_URL=/api` in `website/.env.production` or your hosting provider.
2. Build the site:

```bash
npm run build
```

Use the reverse-proxied `/api` path so the production build does not depend on the Vite dev server.
