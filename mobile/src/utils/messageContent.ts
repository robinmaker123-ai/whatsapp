import type { Message } from "../types/models";

export const getMediaLabel = (message: Pick<Message, "messageType">) => {
  switch (message.messageType) {
    case "video":
      return "Video";
    case "audio":
      return "Voice note";
    case "file":
      return "Document";
    default:
      return "Photo";
  }
};

export const getMessagePreview = (
  message: Message | null | undefined,
  isOwnMessage: boolean
) => {
  if (!message) {
    return "Start a conversation";
  }

  if (message.deletedForEveryone) {
    return "This message was deleted";
  }

  const prefix = isOwnMessage ? "You: " : "";

  if (message.mediaUrl) {
    const caption = message.text.trim();
    const mediaLabel = getMediaLabel(message);
    return `${prefix}${caption ? `${mediaLabel}: ${caption}` : mediaLabel}`;
  }

  if (message.forwardedFrom) {
    return `${prefix}Forwarded message`;
  }

  return `${prefix}${message.text}`;
};
