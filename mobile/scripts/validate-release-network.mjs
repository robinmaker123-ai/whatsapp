import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const mobileDir = process.cwd();
const envPath = path.join(mobileDir, ".env");

if (fs.existsSync(envPath)) {
  const loaded = dotenv.config({ path: envPath });
  dotenvExpand.expand(loaded);
}

const privateHostError = (name, url) =>
  `${name} must point to a public backend URL. Private/LAN hosts are not allowed in release builds: ${url}`;

const missingError = (name) =>
  `${name} is required for release builds. Set it in mobile/.env before creating the APK.`;

const invalidError = (name, value) =>
  `${name} must be a valid absolute URL. Received: ${value || "(empty)"}`;

const unsupportedProtocolError = (name, url) =>
  `${name} should use HTTPS for public release builds. Received: ${url}`;

const isLoopbackHost = (host = "") => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]"
  );
};

const isPrivateIpv4 = (host = "") => {
  const octets = String(host || "")
    .trim()
    .split(".")
    .map((octet) => Number(octet));

  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
};

const isPrivateHost = (host = "") => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  return isLoopbackHost(normalizedHost) || isPrivateIpv4(normalizedHost) || normalizedHost.endsWith(".local");
};

const readRequiredUrl = (name, { allowHttp = false } = {}) => {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(missingError(name));
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(invalidError(name, value));
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    throw new Error(privateHostError(name, parsedUrl.toString()));
  }

  if (!allowHttp && parsedUrl.protocol !== "https:") {
    throw new Error(unsupportedProtocolError(name, parsedUrl.toString()));
  }

  return parsedUrl.toString().replace(/\/+$/, "");
};

const fetchJson = async (url, label) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`${label} returned HTTP ${response.status}. Body: ${text.slice(0, 200)}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error(
        `${label} did not return JSON. This usually means the URL points to a website/dev server instead of the VideoApp backend.`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} returned invalid JSON.`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

const main = async () => {
  const allowHttpRelease = String(process.env.ALLOW_HTTP_RELEASE || "").trim().toLowerCase() === "true";
  const apiBaseUrl = readRequiredUrl("EXPO_PUBLIC_PRODUCTION_API_BASE_URL", {
    allowHttp: allowHttpRelease,
  });
  const socketUrl = readRequiredUrl(
    "EXPO_PUBLIC_PRODUCTION_SOCKET_URL",
    {
      allowHttp: allowHttpRelease,
    }
  );

  const healthPayload = await fetchJson(`${apiBaseUrl}/health`, "Release backend health check");

  if (String(healthPayload.message || "").trim() !== "VideoApp backend is running.") {
    throw new Error(
      `Release backend health check succeeded but does not look like the VideoApp API. Response: ${JSON.stringify(
        healthPayload
      )}`
    );
  }

  console.log("Release network configuration looks valid.");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Socket: ${socketUrl}`);

  if (allowHttpRelease) {
    console.warn("ALLOW_HTTP_RELEASE=true is enabled. Public HTTP releases expose traffic without TLS.");
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
