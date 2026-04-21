import axios from "axios";

import { API_BASE_URL } from "../config/env";
import type {
  AppRelease,
  AuthSession,
  CallRecord,
  ChatSummary,
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

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const extractApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;

    if (serverMessage) {
      return serverMessage;
    }

    if (error.code === "ECONNABORTED") {
      return API_BASE_URL
        ? `Request timed out while reaching ${API_BASE_URL}.`
        : "Request timed out.";
    }

    if (!error.response) {
      return API_BASE_URL
        ? `Cannot reach backend at ${API_BASE_URL}. Update mobile/.env with your current LAN IP and make sure the backend is running.`
        : "Backend URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in mobile/.env and restart Expo.";
    }

    return (
      error.message ||
      "Request failed."
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
  });

  return response.data;
};

export const pingServer = async () => {
  if (!API_BASE_URL) {
    return false;
  }

  try {
    await api.get("/health", {
      timeout: 4000,
    });
    return true;
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
  });

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

export const fetchLatestRelease = async (channel = "production") => {
  const response = await api.get<{ release: AppRelease }>("/downloads/latest", {
    params: {
      channel,
    },
  });

  return response.data.release;
};
