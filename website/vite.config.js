import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const normalizeBasePath = (value) => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue || trimmedValue === "/") {
    return "/";
  }

  return `/${trimmedValue.replace(/^\/+|\/+$/g, "")}/`;
};

const resolveBasePath = () => {
  const explicitBasePath = process.env.VITE_BASE_PATH || process.env.BASE_PATH;

  if (explicitBasePath) {
    return normalizeBasePath(explicitBasePath);
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    const repositorySlug = String(process.env.GITHUB_REPOSITORY || "").trim();
    const repoName = repositorySlug.split("/")[1] || "";

    if (repoName) {
      return normalizeBasePath(repoName);
    }
  }

  return "/";
};

export default defineConfig({
  plugins: [react()],
  base: resolveBasePath(),
  server: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
      "/uploads": {
        target: process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
