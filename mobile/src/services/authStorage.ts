import * as SecureStore from "expo-secure-store";

import type { AuthSession } from "../types/models";

const SESSION_KEY = "videoapp-chat-session";

export const saveSession = async (session: AuthSession) => {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
};

export const loadSession = async () => {
  const rawSession = await SecureStore.getItemAsync(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch (error) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
};

export const clearSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_KEY);
};
