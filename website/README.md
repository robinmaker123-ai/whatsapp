# VideoApp Website

Public React website for the VideoApp ecosystem.

## Pages

- Home
- Features
- Screenshots
- Download
- Support

## Local run

```bash
npm install
copy .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the live backend URL so the Download page can read `/downloads/latest`.

## Build

```bash
npm run build
```

The site uses a `HashRouter`, which makes GitHub Pages deployment straightforward.
