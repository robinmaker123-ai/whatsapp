const trimTrailingSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const readEnvValue = (...names) =>
  names
    .map((name) => trimTrailingSlash(import.meta.env?.[name]))
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

const sleep = (delayMs) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const buildFriendlyError = (data, response) => {
  if (data && typeof data === "object" && typeof data.message === "string") {
    return new Error(data.message);
  }

  return new Error(`Request failed with ${response.status}`);
};

const parseResponsePayload = async (response) => {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");
  return {
    message: text ? text.slice(0, 200) : "",
  };
};

const shouldRetryRequest = (response, error, retriesRemaining) => {
  if (retriesRemaining <= 0) {
    return false;
  }

  if (error) {
    return true;
  }

  return Boolean(response && RETRYABLE_STATUS_CODES.has(response.status));
};

export const BASE_URL = toAbsoluteUrl(readEnvValue("VITE_API_URL"));
export const SOCKET_URL =
  toAbsoluteUrl(readEnvValue("VITE_SOCKET_URL", "VITE_API_URL")) || BASE_URL;
export const IS_API_CONFIGURED = Boolean(BASE_URL);
export const SERVER_UNAVAILABLE_MESSAGE = "Server temporarily unavailable. Please try again shortly.";

export const buildApiUrl = (path = "") => {
  if (!BASE_URL) {
    return "";
  }

  return new URL(String(path || "").replace(/^\/+/, ""), `${BASE_URL}/`).toString();
};

export const requestJsonWithRetry = async (
  url,
  options = {},
  retryOptions = {}
) => {
  const retries = Number.isFinite(Number(retryOptions.retries))
    ? Number(retryOptions.retries)
    : 2;
  const retryDelayMs = Number.isFinite(Number(retryOptions.retryDelayMs))
    ? Number(retryOptions.retryDelayMs)
    : 600;
  const fallbackMessage =
    String(retryOptions.fallbackMessage || "").trim() || SERVER_UNAVAILABLE_MESSAGE;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const data = await parseResponsePayload(response);

      if (response.ok) {
        return data;
      }

      if (shouldRetryRequest(response, null, retries - attempt)) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      throw buildFriendlyError(data, response);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!shouldRetryRequest(null, lastError, retries - attempt)) {
        break;
      }

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  if (lastError && String(lastError.message || "").trim()) {
    const normalizedMessage = String(lastError.message || "").trim().toLowerCase();

    if (normalizedMessage === "failed to fetch") {
      throw new Error(fallbackMessage);
    }

    throw lastError;
  }

  throw new Error(fallbackMessage);
};
