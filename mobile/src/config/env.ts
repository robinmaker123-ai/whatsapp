import { NativeModules } from "react-native";

const DEFAULT_BACKEND_PORT = 5000;
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

const resolveUrl = (value?: string) => {
  const normalizedValue = normalizeUrl(value || "");

  if (!normalizedValue) {
    return "";
  }

  try {
    return new URL(normalizedValue).toString().replace(/\/$/, "");
  } catch (error) {
    if (__DEV__) {
      console.warn("[env] invalid url ignored", normalizedValue);
    }

    return "";
  }
};

const extractHostname = (value: string) => {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).hostname;
  } catch (error) {
    return "";
  }
};

const isLoopbackHost = (host: string) => LOCALHOST_HOSTNAMES.has(host.trim().toLowerCase());

const isPrivateIpv4 = (host: string) => {
  const octets = host.split(".").map((octet) => Number(octet));

  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  if (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)) {
    return true;
  }

  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
};

const isPrivateHost = (host: string) => isLoopbackHost(host) || isPrivateIpv4(host);

const resolvePublicReleaseUrl = (value?: string) => {
  const resolvedUrl = resolveUrl(value);

  if (!resolvedUrl) {
    return "";
  }

  const host = extractHostname(resolvedUrl);

  if (isPrivateHost(host)) {
    return "";
  }

  return resolvedUrl;
};

const resolveBackendPort = () => {
  const parsedPort = Number(process.env.EXPO_PUBLIC_BACKEND_PORT || DEFAULT_BACKEND_PORT);

  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return DEFAULT_BACKEND_PORT;
  }

  return parsedPort;
};

const resolveRuntimeLanUrl = () => {
  if (!__DEV__) {
    return "";
  }

  const sourceCode = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode;
  const scriptUrl = normalizeUrl(sourceCode?.scriptURL || "");

  if (!scriptUrl) {
    return "";
  }

  try {
    const parsedScriptUrl = new URL(scriptUrl);
    return `http://${parsedScriptUrl.hostname}:${resolveBackendPort()}`;
  } catch (error) {
    if (__DEV__) {
      console.warn("[env] invalid scriptURL ignored", scriptUrl);
    }

    return "";
  }
};

const developmentApiBaseUrl = resolveUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const developmentSocketUrl = resolveUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_BASE_URL
);
const releaseApiBaseUrl = resolvePublicReleaseUrl(
  process.env.EXPO_PUBLIC_PRODUCTION_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL
);
const releaseSocketUrl = resolvePublicReleaseUrl(
  process.env.EXPO_PUBLIC_PRODUCTION_SOCKET_URL ||
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    process.env.EXPO_PUBLIC_PRODUCTION_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL
);
const runtimeLanUrl = resolveUrl(resolveRuntimeLanUrl());

const configuredApiBaseUrl = __DEV__ ? developmentApiBaseUrl : releaseApiBaseUrl;
const configuredSocketUrl = __DEV__ ? developmentSocketUrl : releaseSocketUrl;

const configuredApiHost = extractHostname(configuredApiBaseUrl);
const runtimeLanHost = extractHostname(runtimeLanUrl);

const shouldPreferRuntimeLanUrl =
  __DEV__ &&
  Boolean(runtimeLanUrl) &&
  (!configuredApiBaseUrl ||
    (isPrivateHost(configuredApiHost) && configuredApiHost !== runtimeLanHost));

const selectedApiBaseUrl = shouldPreferRuntimeLanUrl ? runtimeLanUrl : configuredApiBaseUrl;
const selectedSocketUrl = shouldPreferRuntimeLanUrl
  ? runtimeLanUrl
  : configuredSocketUrl || selectedApiBaseUrl || runtimeLanUrl;

export const API_BASE_URL = selectedApiBaseUrl;
export const SOCKET_URL = selectedSocketUrl;
export const IS_NETWORK_CONFIGURED = Boolean(API_BASE_URL && SOCKET_URL);
export const IS_DEV_BUILD = __DEV__;
export const LOGIN_NETWORK_SUBTITLE = IS_DEV_BUILD
  ? "Connect your Android app to the real Node, MongoDB, and Socket.io backend over LAN."
  : "Connect your Android app to the live Node, MongoDB, and Socket.io backend.";
export const STARTUP_NETWORK_SUBTITLE = IS_DEV_BUILD
  ? "Restoring your session, refreshing the socket, and checking the LAN backend."
  : "Restoring your session, refreshing the socket, and checking the live backend.";
export const CONNECTED_STATUS_LABEL = IS_DEV_BUILD ? "Backend connected" : "Backend online";
export const DISCONNECTED_STATUS_LABEL = IS_DEV_BUILD
  ? "Waiting for backend"
  : "Backend unavailable";
export const NETWORK_CONFIG_HINT = IS_DEV_BUILD
  ? "Update mobile/.env with your current LAN IP and make sure the backend is running."
  : "This release build needs a public backend URL. Rebuild with EXPO_PUBLIC_PRODUCTION_API_BASE_URL and EXPO_PUBLIC_PRODUCTION_SOCKET_URL pointing to your live API.";
export const NETWORK_MISSING_CONFIG_MESSAGE = IS_DEV_BUILD
  ? "Backend URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env and restart Expo."
  : "This release build is missing a public backend URL. Set EXPO_PUBLIC_PRODUCTION_API_BASE_URL and EXPO_PUBLIC_PRODUCTION_SOCKET_URL before building the APK.";

if (__DEV__) {
  console.log("[env] mobile", {
    apiBaseUrl: API_BASE_URL || "not-configured",
    socketUrl: SOCKET_URL || "not-configured",
    configuredApiBaseUrl: configuredApiBaseUrl || "not-configured",
    releaseApiBaseUrl: releaseApiBaseUrl || "not-configured",
    runtimeLanUrl: runtimeLanUrl || "not-detected",
    configSource: shouldPreferRuntimeLanUrl ? "runtime-lan" : "env",
    isNetworkConfigured: IS_NETWORK_CONFIGURED,
  });
}
