import type { Message, MessageSeenPayload } from "../types/models";

const getMessageSortTime = (message: Message) =>
  new Date(message.createdAt).getTime();

const sortMessages = (messages: Message[]) =>
  [...messages].sort(
    (firstMessage, secondMessage) =>
      getMessageSortTime(firstMessage) - getMessageSortTime(secondMessage)
  );

const isSameMessage = (firstMessage: Message, secondMessage: Message) =>
  firstMessage.id === secondMessage.id ||
  Boolean(
    firstMessage.clientTempId &&
      secondMessage.clientTempId &&
      firstMessage.clientTempId === secondMessage.clientTempId
  );

export const mergeMessage = (messages: Message[], incomingMessage: Message) => {
  const existingIndex = messages.findIndex((messageItem) =>
    isSameMessage(messageItem, incomingMessage)
  );

  if (existingIndex === -1) {
    return sortMessages([
      ...messages,
      {
        ...incomingMessage,
        isOptimistic: false,
      },
    ]);
  }

  return sortMessages(
    messages.map((messageItem, index) =>
      index === existingIndex
        ? {
            ...messageItem,
            ...incomingMessage,
            isOptimistic: false,
          }
        : messageItem
    )
  );
};

export const mergeMessages = (messages: Message[], nextMessages: Message[]) =>
  nextMessages.reduce(
    (currentMessages, nextMessage) => mergeMessage(currentMessages, nextMessage),
    messages
  );

export const applySeenUpdate = (
  messages: Message[],
  payload: MessageSeenPayload
) =>
  messages.map((messageItem) =>
    messageItem.id === payload.messageId
      ? {
          ...messageItem,
          status: payload.status,
          deliveredAt: payload.deliveredAt,
          seenAt: payload.seenAt,
        }
      : messageItem
  );

export const removeOptimisticMessage = (
  messages: Message[],
  clientTempId?: string
) => {
  if (!clientTempId) {
    return messages;
  }

  return messages.filter((messageItem) => messageItem.clientTempId !== clientTempId);
};
