import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const mobileDir = process.cwd();
const envFiles = [
  ".env.production",
  ".env.production.local",
  ".env",
  ".env.local",
];

envFiles.forEach((fileName) => {
  const targetPath = path.join(mobileDir, fileName);

  if (!fs.existsSync(targetPath)) {
    return;
  }

  const loaded = dotenv.config({
    path: targetPath,
    override: false,
  });

  dotenvExpand.expand(loaded);
});

const missingError = (name) =>
  `${name} is required for production Android builds. Set it in mobile/.env.production or your build environment before creating the APK.`;

const invalidError = (name, value) =>
  `${name} must be a valid absolute URL. Received: ${value || "(empty)"}`;

const unsupportedProtocolError = (name, url) =>
  `${name} should use http:// or https://. Received: ${url}`;

const privateHostError = (name, url) =>
  `${name} must point to a public backend URL. Private or loopback hosts are not allowed for production APKs: ${url}`;

const readEnvValue = (...names) =>
  names
    .map((name) => String(process.env[name] || "").trim())
    .find(Boolean) || "";

const isIpv4Host = (host = "") => {
  const octets = String(host || "")
    .trim()
    .split(".")
    .map((octet) => Number(octet));

  return octets.length === 4 && octets.every((octet) => Number.isInteger(octet));
};

const isPrivateIpv4Host = (host = "") => {
  if (!isIpv4Host(host)) {
    return false;
  }

  const [firstOctet, secondOctet] = host.split(".").map((octet) => Number(octet));

  return (
    firstOctet === 10 ||
    firstOctet === 127 ||
    (firstOctet === 169 && secondOctet === 254) ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)
  );
};

const isNonPublicHostname = (host = "") => {
  const normalizedHost = String(host || "").trim().toLowerCase();

  if (!normalizedHost) {
    return true;
  }

  if (normalizedHost === "::1" || normalizedHost === "[::1]") {
    return true;
  }

  if (normalizedHost.endsWith(".local")) {
    return true;
  }

  if (isPrivateIpv4Host(normalizedHost)) {
    return true;
  }

  if (!normalizedHost.includes(".") && !isIpv4Host(normalizedHost)) {
    return true;
  }

  return false;
};

const readRequiredUrl = (primaryName, ...fallbackNames) => {
  const value = readEnvValue(primaryName, ...fallbackNames);

  if (!value) {
    throw new Error(missingError(primaryName));
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(invalidError(primaryName, value));
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(unsupportedProtocolError(primaryName, parsedUrl.toString()));
  }

  if (isNonPublicHostname(parsedUrl.hostname)) {
    throw new Error(privateHostError(primaryName, parsedUrl.toString()));
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
        `${label} did not return JSON. This usually means the configured URL points to a website instead of the VideoApp backend API.`
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
  const apiBaseUrl = readRequiredUrl(
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_PRODUCTION_API_BASE_URL",
    "EXPO_PUBLIC_API_BASE_URL"
  );
  const socketUrl = readRequiredUrl(
    "EXPO_PUBLIC_SOCKET_URL",
    "EXPO_PUBLIC_PRODUCTION_SOCKET_URL",
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_PRODUCTION_API_BASE_URL",
    "EXPO_PUBLIC_API_BASE_URL"
  );

  const healthPayload = await fetchJson(
    `${apiBaseUrl}/health`,
    "Production backend health check"
  );

  if (String(healthPayload.message || "").trim() !== "VideoApp backend is running.") {
    throw new Error(
      `Production backend health check succeeded but does not look like the VideoApp API. Response: ${JSON.stringify(
        healthPayload
      )}`
    );
  }

  console.log("Production network configuration looks valid.");
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Socket: ${socketUrl}`);

  if (apiBaseUrl.startsWith("http://") || socketUrl.startsWith("http://")) {
    console.warn(
      "Public HTTP is configured for the Android release. HTTPS is strongly recommended for production."
    );
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
