import type { CallRecord, UserStatus } from "../types/models";

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDateTime = (value: string) => {
  const date = new Date(value);
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatMessageTime = (value: string) => {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const period = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;

  return `${normalizedHour}:${minutes} ${period}`;
};

export const formatChatPreviewTime = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return formatMessageTime(value);
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
};

export const formatLastSeen = (value?: string | null) => {
  if (!value) {
    return "Last seen recently";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return `Last seen today at ${formatMessageTime(value)}`;
  }

  return `Last seen on ${formatDateTime(value)}`;
};

export const formatPresenceText = (
  status: UserStatus,
  lastSeen?: string | null
) => {
  if (status === "online") {
    return "Online";
  }

  if (!lastSeen) {
    return "Offline";
  }

  return `Offline - ${formatLastSeen(lastSeen)}`;
};

export const getInitials = (name: string) => {
  const cleanedName = name.trim();

  if (!cleanedName) {
    return "U";
  }

  const parts = cleanedName.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

export const formatDuration = (durationSeconds?: number | null) => {
  const totalSeconds = Math.max(0, Math.round(durationSeconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${pad(minutes)}:${pad(seconds)}`;
};

export const formatCallSubtitle = (call: CallRecord) => {
  const label =
    call.status === "missed"
      ? "Missed"
      : call.direction === "incoming"
        ? "Incoming"
        : "Outgoing";
  const suffix = call.type === "video" ? "video" : "voice";

  if (call.durationSeconds) {
    return `${label} | ${suffix} | ${formatDuration(call.durationSeconds)}`;
  }

  return `${label} | ${suffix}`;
};
