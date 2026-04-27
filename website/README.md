# VideoApp Website

Public Vite + React website for landing pages, APK downloads, updates, and admin access.

## Environment files

- `website/.env.development`
- `website/.env.production`

Variables:

```bash
VITE_API_URL=/api
VITE_API_BASE_URL=
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

1. Set `VITE_API_URL=/api` when the website and backend share one public host behind a reverse proxy.
2. Set `VITE_API_URL=https://api.videoapp.example/api` when the website is deployed on a separate static host such as GitHub Pages, Netlify, or Vercel without an edge rewrite to the backend.
3. `VITE_API_BASE_URL` is also supported as a compatibility alias for CI and hosted builds.
4. Build the site:

```bash
npm run build
```

Use the reverse-proxied `/api` path only when your hosting layer forwards that path to the backend. Otherwise use the backend's absolute public API URL.
