import { NativeModules } from "react-native";

const DEFAULT_BACKEND_PORT = 5000;

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

const configuredApiBaseUrl = resolveUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
const configuredSocketUrl = resolveUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_BASE_URL
);
const runtimeLanUrl = resolveUrl(resolveRuntimeLanUrl());

const configuredApiHost = extractHostname(configuredApiBaseUrl);
const runtimeLanHost = extractHostname(runtimeLanUrl);

const shouldPreferRuntimeLanUrl =
  __DEV__ &&
  Boolean(runtimeLanUrl) &&
  (!configuredApiBaseUrl ||
    (isPrivateIpv4(configuredApiHost) && configuredApiHost !== runtimeLanHost));

const selectedApiBaseUrl = shouldPreferRuntimeLanUrl ? runtimeLanUrl : configuredApiBaseUrl;
const selectedSocketUrl = shouldPreferRuntimeLanUrl
  ? runtimeLanUrl
  : configuredSocketUrl || selectedApiBaseUrl || runtimeLanUrl;

export const API_BASE_URL = selectedApiBaseUrl;
export const SOCKET_URL = selectedSocketUrl;
export const IS_NETWORK_CONFIGURED = Boolean(API_BASE_URL && SOCKET_URL);

if (__DEV__) {
  console.log("[env] mobile", {
    apiBaseUrl: API_BASE_URL || "not-configured",
    socketUrl: SOCKET_URL || "not-configured",
    configuredApiBaseUrl: configuredApiBaseUrl || "not-configured",
    runtimeLanUrl: runtimeLanUrl || "not-detected",
    configSource: shouldPreferRuntimeLanUrl ? "runtime-lan" : "env",
    isNetworkConfigured: IS_NETWORK_CONFIGURED,
  });
}
