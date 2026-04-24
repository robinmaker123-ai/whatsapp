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

If you do not want to depend on the backend release endpoint, set `VITE_DIRECT_DOWNLOAD_URL` to a direct APK file URL and the main button will download the app from that link.

Set `VITE_BASE_PATH=/repo-name/` when the site is hosted under a subpath such as GitHub Pages project sites. The GitHub Actions Pages build also auto-detects the repository name and applies that base path.

## Build

```bash
npm run build
```
