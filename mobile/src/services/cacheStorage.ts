import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CallRecord, ChatSummary, Message, StatusFeedEntry } from "../types/models";

const keyForConversation = (userId: string) => `videoapp-conversation:${userId}`;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const cacheChats = (chats: ChatSummary[]) =>
  writeJson("videoapp-chats", chats);

export const loadCachedChats = () =>
  readJson<ChatSummary[]>("videoapp-chats", []);

export const cacheConversation = (userId: string, messages: Message[]) =>
  writeJson(keyForConversation(userId), messages);

export const loadCachedConversation = (userId: string) =>
  readJson<Message[]>(keyForConversation(userId), []);

export const cacheStatuses = (feed: { mine: StatusFeedEntry | null; feed: StatusFeedEntry[] }) =>
  writeJson("videoapp-status-feed", feed);

export const loadCachedStatuses = () =>
  readJson<{ mine: StatusFeedEntry | null; feed: StatusFeedEntry[] }>(
    "videoapp-status-feed",
    { mine: null, feed: [] }
  );

export const cacheCalls = (calls: CallRecord[]) =>
  writeJson("videoapp-calls", calls);

export const loadCachedCalls = () =>
  readJson<CallRecord[]>("videoapp-calls", []);
