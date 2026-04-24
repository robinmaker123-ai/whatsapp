import * as Application from "expo-application";
import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

import {
  BASE_URL as API_BASE_URL,
  NETWORK_MISSING_CONFIG_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from "../config/api";
import type {
  AppRelease,
  AuthSession,
  CallRecord,
  ChatSummary,
  Community,
  ContactHashInput,
  MediaUploadResponse,
  Message,
  MatchedContactsResponse,
  PendingMedia,
  SendMessagePayload,
  StatusFeedEntry,
  StatusItem,
  ThemePreference,
  User,
} from "../types/models";

const EXPECTED_HEALTH_MESSAGE = "VideoApp backend is running.";
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_LIMIT = 2;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  retryCount?: number;
  retryLimit?: number;
  retryable?: boolean;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const delay = (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const getHeaderValue = (headers: unknown, headerName: string) => {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof AxiosHeaders) {
    return headers.get(headerName);
  }

  if (typeof headers === "object") {
    const normalizedHeaders = headers as Record<string, unknown>;
    return (
      normalizedHeaders[headerName] ??
      normalizedHeaders[headerName.toLowerCase()] ??
      normalizedHeaders[headerName.toUpperCase()]
    );
  }

  return undefined;
};

const getResponseContentType = (response?: {
  headers?: unknown;
}) => {
  const rawContentType = getHeaderValue(response?.headers, "content-type");

  if (!rawContentType) {
    return "";
  }

  if (Array.isArray(rawContentType)) {
    return rawContentType.map((value) => String(value || "")).join(";").toLowerCase();
  }

  return String(rawContentType || "").toLowerCase();
};

const looksLikeHtmlDocument = (value: unknown) =>
  typeof value === "string" && /<(?:!doctype|html|head|body)\b/i.test(value);

const isExpectedHealthPayload = (value: unknown): value is { message: string } =>
  Boolean(
    value &&
      typeof value === "object" &&
      "message" in value &&
      (value as { message?: string }).message === EXPECTED_HEALTH_MESSAGE
  );

const isUnexpectedBackendTarget = (response?: {
  data?: unknown;
  headers?: unknown;
}) => {
  if (!response) {
    return false;
  }

  const contentType = getResponseContentType(response);

  if (contentType.includes("text/html")) {
    return true;
  }

  return looksLikeHtmlDocument(response.data);
};

const shouldRetryRequest = (error: AxiosError) => {
  const requestConfig = error.config as RetriableRequestConfig | undefined;

  if (!requestConfig) {
    return false;
  }

  const retryCount = requestConfig.retryCount || 0;
  const retryLimit =
    requestConfig.retryLimit ??
    (String(requestConfig.method || "get").toLowerCase() === "get"
      ? DEFAULT_RETRY_LIMIT
      : 0);

  if (retryCount >= retryLimit) {
    return false;
  }

  if (requestConfig.retryable === false) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return RETRYABLE_STATUS_CODES.has(error.response.status);
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!shouldRetryRequest(error)) {
      return Promise.reject(error);
    }

    const requestConfig = error.config as RetriableRequestConfig;
    requestConfig.retryCount = (requestConfig.retryCount || 0) + 1;

    await delay(500 * requestConfig.retryCount);
    return api.request(requestConfig);
  }
);

const deviceHeaders = () => ({
  "x-device-id":
    Application.applicationId || "mobile-device",
  "x-device-name": Application.applicationName || "VideoApp Mobile",
  "x-platform": Platform.OS,
  "x-app-version": Application.nativeApplicationVersion || "dev",
  "x-app-build": Application.nativeBuildVersion || "0",
});

const authHeaders = (token: string) => ({
  ...deviceHeaders(),
  Authorization: `Bearer ${token}`,
});

export const extractApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (isUnexpectedBackendTarget(error.response)) {
      return SERVER_UNAVAILABLE_MESSAGE;
    }

    const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;

    if (serverMessage) {
      return serverMessage;
    }

    if (error.code === "ECONNABORTED") {
      return SERVER_UNAVAILABLE_MESSAGE;
    }

    if (!error.response) {
      return API_BASE_URL ? SERVER_UNAVAILABLE_MESSAGE : NETWORK_MISSING_CONFIG_MESSAGE;
    }

    if (error.response.status >= 500) {
      return SERVER_UNAVAILABLE_MESSAGE;
    }

    return (
      error.message ||
      SERVER_UNAVAILABLE_MESSAGE
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
};

export const sendOtpRequest = async (phone: string) => {
  const response = await api.post<{
    message: string;
    phone: string;
    expiresInMinutes: number;
    mockOtp?: string;
  }>("/auth/send-otp", {
    phone,
  }, {
    headers: deviceHeaders(),
  });

  return response.data;
};

export const pingServer = async () => {
  if (!API_BASE_URL) {
    return false;
  }

  try {
    const response = await api.get("/health", {
      timeout: 4000,
      retryLimit: 2,
    } as RetriableRequestConfig);

    const contentType = getResponseContentType(response);
    const isJsonResponse = !contentType || contentType.includes("application/json");
    const isHealthyBackend = isJsonResponse && isExpectedHealthPayload(response.data);

    if (!isHealthyBackend && __DEV__) {
      console.warn("[api] unexpected /health response", {
        apiBaseUrl: API_BASE_URL,
        contentType: contentType || "unknown",
      });
    }

    return isHealthyBackend;
  } catch (error) {
    return false;
  }
};

export const verifyOtpRequest = async (
  phone: string,
  otp: string,
  profile: {
    name?: string;
    about?: string;
    profilePic?: string;
  } = {}
) => {
  const response = await api.post<AuthSession>("/auth/verify-otp", {
    phone,
    otp,
    ...profile,
  }, {
    headers: deviceHeaders(),
  });

  return response.data;
};

export const refreshSessionRequest = async (refreshToken: string) => {
  const response = await api.post<AuthSession>(
    "/auth/refresh",
    {
      refreshToken,
    },
    {
      headers: deviceHeaders(),
    }
  );

  return response.data;
};

export const fetchProfile = async (token: string) => {
  const response = await api.get<{ user: User }>("/user/profile", {
    headers: authHeaders(token),
  });

  return response.data.user;
};

export const updateProfile = async (
  token: string,
  payload: {
    name?: string;
    about?: string;
    profilePic?: string;
  }
) => {
  const response = await api.patch<{ user: User }>("/user/profile", payload, {
    headers: authHeaders(token),
  });

  return response.data.user;
};

export const updateSettings = async (
  token: string,
  payload: {
    themePreference?: ThemePreference;
    privacy?: User["privacy"];
    notifications?: User["notifications"];
  }
) => {
  const response = await api.patch<{ user: User }>("/user/settings", payload, {
    headers: authHeaders(token),
  });

  return response.data.user;
};

export const fetchUsers = async (token: string, search = "") => {
  const response = await api.get<{ users: User[] }>("/users", {
    headers: authHeaders(token),
    params: search ? { search } : undefined,
  });

  return response.data.users;
};

export const fetchMatchedContacts = async (token: string, search = "") => {
  const response = await api.get<MatchedContactsResponse>("/users/matched-contacts", {
    headers: authHeaders(token),
    params: search ? { search } : undefined,
  });

  return response.data;
};

export const syncMatchedContactsRequest = async (
  token: string,
  contacts: ContactHashInput[]
) => {
  const response = await api.post<MatchedContactsResponse>(
    "/users/matched-contacts/sync",
    {
      contacts,
    },
    {
      headers: authHeaders(token),
    }
  );

  return response.data;
};

export const fetchChats = async (
  token: string,
  options: { search?: string; archived?: boolean } = {}
) => {
  const response = await api.get<{ chats: ChatSummary[] }>("/user/chats", {
    headers: authHeaders(token),
    params: {
      ...(options.search ? { search: options.search } : {}),
      ...(options.archived ? { archived: true } : {}),
    },
  });

  return response.data.chats;
};

export const updateChatPreferences = async (
  token: string,
  userId: string,
  payload: {
    isPinned?: boolean;
    isArchived?: boolean;
  }
) => {
  await api.patch(`/user/chats/${userId}/preferences`, payload, {
    headers: authHeaders(token),
  });
};

export const updateBlockedContact = async (
  token: string,
  userId: string,
  isBlocked: boolean
) => {
  const response = await api.patch<{ blockedContacts: string[] }>(
    `/user/blocked/${userId}`,
    { isBlocked },
    {
      headers: authHeaders(token),
    }
  );

  return response.data.blockedContacts;
};

export const fetchConversation = async (token: string, userId: string) => {
  const response = await api.get<{ messages: Message[] }>(`/messages/${userId}`, {
    headers: authHeaders(token),
  });

  return response.data.messages;
};

export const sendMessageRequest = async (
  token: string,
  payload: SendMessagePayload
) => {
  const response = await api.post<{ message: Message }>("/messages/send", payload, {
    headers: authHeaders(token),
  });

  return response.data.message;
};

export const deleteMessageRequest = async (
  token: string,
  messageId: string,
  deleteMode: "for_me" | "for_everyone"
) => {
  const response = await api.patch<{ message: Message }>(
    `/messages/${messageId}/delete`,
    { deleteMode },
    {
      headers: authHeaders(token),
    }
  );

  return response.data.message;
};

export const forwardMessageRequest = async (
  token: string,
  messageId: string,
  receiverId: string
) => {
  const response = await api.post<{ message: Message }>(
    `/messages/${messageId}/forward`,
    { receiverId },
    {
      headers: authHeaders(token),
    }
  );

  return response.data.message;
};

export const uploadMedia = async (token: string, media: PendingMedia) => {
  const formData = new FormData();

  formData.append(
    "media",
    {
      uri: media.uri,
      name: media.fileName,
      type: media.mimeType,
    } as unknown as Blob
  );

  const response = await api.post<{ upload: MediaUploadResponse }>(
    "/media/upload",
    formData,
    {
      headers: {
        ...authHeaders(token),
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data.upload;
};

export const fetchStatusFeed = async (token: string) => {
  const response = await api.get<{
    mine: StatusFeedEntry | null;
    feed: StatusFeedEntry[];
  }>("/status", {
    headers: authHeaders(token),
  });

  return response.data;
};

export const createStatusRequest = async (
  token: string,
  payload: {
    type: StatusItem["type"];
    text?: string;
    mediaUrl?: string;
    mediaName?: string;
    mediaMimeType?: string;
    backgroundColor?: string;
  }
) => {
  const response = await api.post<{ status: StatusItem }>("/status", payload, {
    headers: authHeaders(token),
  });

  return response.data.status;
};

export const markStatusViewedRequest = async (token: string, statusId: string) => {
  const response = await api.post<{ status: StatusItem }>(
    `/status/${statusId}/view`,
    {},
    {
      headers: authHeaders(token),
    }
  );

  return response.data.status;
};

export const deleteStatusRequest = async (token: string, statusId: string) => {
  await api.delete(`/status/${statusId}`, {
    headers: authHeaders(token),
  });
};

export const fetchCalls = async (token: string) => {
  const response = await api.get<{ calls: CallRecord[] }>("/calls", {
    headers: authHeaders(token),
  });

  return response.data.calls;
};

export const createCallRequest = async (
  token: string,
  receiverId: string,
  type: CallRecord["type"]
) => {
  const response = await api.post<{ call: CallRecord }>(
    "/calls",
    { receiverId, type },
    {
      headers: authHeaders(token),
    }
  );

  return response.data.call;
};

export const updateCallRequest = async (
  token: string,
  callId: string,
  status: CallRecord["status"]
) => {
  const response = await api.patch<{ call: CallRecord }>(
    `/calls/${callId}`,
    { status },
    {
      headers: authHeaders(token),
    }
  );

  return response.data.call;
};

export const fetchCommunities = async (token: string, search = "") => {
  const response = await api.get<{ communities: Community[] }>("/community", {
    headers: authHeaders(token),
    params: search ? { search } : undefined,
  });

  return response.data.communities;
};

export const createCommunityRequest = async (
  token: string,
  payload: {
    name: string;
    description?: string;
    avatarUrl?: string;
  }
) => {
  const response = await api.post<{ community: Community }>("/community", payload, {
    headers: authHeaders(token),
  });

  return response.data.community;
};

export const fetchLatestRelease = async (channel = "production") => {
  const response = await api.get<{ release: AppRelease }>("/downloads/latest", {
    params: {
      channel,
    },
  });

  return response.data.release;
};
