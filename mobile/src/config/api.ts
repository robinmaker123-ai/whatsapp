const trimTrailingSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const readEnvValue = (...names: string[]) =>
  names
    .map((name) => trimTrailingSlash(process.env[name]))
    .find(Boolean) || "";

const toAbsoluteUrl = (value = "") => {
  const normalizedValue = trimTrailingSlash(value);

  if (!normalizedValue) {
    return "";
  }

  try {
    return new URL(normalizedValue).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const APP_ENV =
  String(readEnvValue("EXPO_PUBLIC_APP_ENV") || (__DEV__ ? "development" : "production"))
    .trim()
    .toLowerCase() || "development";

export const BASE_URL = toAbsoluteUrl(readEnvValue("EXPO_PUBLIC_API_URL"));
export const SOCKET_URL =
  toAbsoluteUrl(
    readEnvValue(
      "EXPO_PUBLIC_SOCKET_URL",
      "EXPO_PUBLIC_API_URL"
    )
  ) || BASE_URL;

export const IS_PRODUCTION_ENV = APP_ENV === "production" || !__DEV__;
export const IS_DEVELOPMENT_ENV = !IS_PRODUCTION_ENV;
export const IS_NETWORK_CONFIGURED = Boolean(BASE_URL && SOCKET_URL);
export const SHOW_DEBUG_NETWORK_DETAILS = IS_DEVELOPMENT_ENV;
export const DEBUG_BACKEND_TARGET_LABEL =
  BASE_URL ||
  (IS_DEVELOPMENT_ENV
    ? "configure mobile/.env.development"
    : "configure mobile/.env.production");

export const LOGIN_NETWORK_SUBTITLE = IS_DEVELOPMENT_ENV
  ? "Connect your Android app to the configured development VideoApp server."
  : "Connect your Android app to the live VideoApp server.";
export const STARTUP_NETWORK_SUBTITLE = IS_DEVELOPMENT_ENV
  ? "Restoring your session, reconnecting the socket, and checking the development server."
  : "Restoring your session, reconnecting the socket, and checking the live server.";
export const CONNECTED_STATUS_LABEL = IS_DEVELOPMENT_ENV
  ? "Development server ready"
  : "Server connected";
export const DISCONNECTED_STATUS_LABEL = "Server unavailable";
export const SERVER_UNAVAILABLE_MESSAGE =
  "Server temporarily unavailable. Please try again in a moment.";
export const NETWORK_CONFIG_HINT = IS_DEVELOPMENT_ENV
  ? "Check EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL in mobile/.env.development."
  : "Check EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL in mobile/.env.production before building the APK.";
export const NETWORK_MISSING_CONFIG_MESSAGE = IS_DEVELOPMENT_ENV
  ? "API configuration missing. Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL in mobile/.env.development."
  : "API configuration missing. Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL in mobile/.env.production before building the APK.";

if (__DEV__) {
  console.log("[config/api] mobile", {
    appEnv: APP_ENV,
    baseUrl: BASE_URL || "not-configured",
    socketUrl: SOCKET_URL || "not-configured",
    isNetworkConfigured: IS_NETWORK_CONFIGURED,
  });
}
