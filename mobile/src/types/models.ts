export type UserStatus = "online" | "offline";
export type ThemePreference = "system" | "light" | "dark";
export type MessageStatus = "sent" | "delivered" | "seen";
export type MediaType = "text" | "image" | "video" | "audio" | "file";
export type UploadableMediaType = Exclude<MediaType, "text">;
export type StatusType = "text" | "image" | "video";
export type CallType = "voice" | "video";
export type CallDirection = "incoming" | "outgoing";
export type CallStatus =
  | "ringing"
  | "accepted"
  | "rejected"
  | "missed"
  | "ended"
  | "cancelled";

export type UserPrivacy = {
  readReceipts: boolean;
  callVisibility: "everyone" | "contacts" | "nobody";
  lastSeenVisibility: "everyone" | "contacts" | "nobody";
  statusVisibility: "everyone" | "contacts" | "nobody";
  profilePhotoVisibility: "everyone" | "contacts" | "nobody";
};

export type UserNotifications = {
  messagePreview: boolean;
  callAlerts: boolean;
  vibrate: boolean;
};

export type ContactSyncInfo = {
  lastSyncedAt?: string | null;
  syncedCount: number;
  matchedCount: number;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  profilePic: string;
  about?: string;
  status: UserStatus;
  lastSeen?: string | null;
  createdAt?: string;
  updatedAt?: string;
  themePreference?: ThemePreference;
  privacy?: UserPrivacy;
  notifications?: UserNotifications;
  blockedContacts?: string[];
  matchedContactIds?: string[];
  contactSync?: ContactSyncInfo;
};

export type ContactHashInput = {
  hash: string;
  displayName: string;
  phone: string;
};

export type InviteCandidate = {
  hash: string;
  displayName: string;
  phone: string;
  inviteLink?: string;
  inviteMessage: string;
};

export type MatchedContactsResponse = {
  users: User[];
  inviteCandidates: InviteCandidate[];
  syncedCount: number;
  matchedCount: number;
  syncedAt?: string | null;
};

export type AuthSession = {
  token: string;
  accessToken?: string;
  refreshToken?: string;
  session?: {
    id: string;
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    appVersion?: string;
    appBuildNumber?: string;
    expiresAt?: string;
    lastUsedAt?: string;
    isCurrent?: boolean;
  } | null;
  user: User;
};

export type ReplyPreview = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  messageType: MediaType;
  mediaUrl?: string;
  createdAt: string;
};

export type Message = {
  id: string;
  clientTempId?: string;
  senderId: string;
  receiverId: string;
  text: string;
  messageType: MediaType;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  fileSize?: number | null;
  voiceNoteDuration?: number | null;
  replyToMessage?: ReplyPreview | null;
  forwardedFrom?: string;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  createdAt: string;
  status: MessageStatus;
  deliveredAt?: string | null;
  seenAt?: string | null;
  isOptimistic?: boolean;
};

export type ChatSummary = {
  user: User;
  lastMessage: Message | null;
  unreadCount: number;
  isPinned?: boolean;
  isArchived?: boolean;
  pinnedAt?: string | null;
};

export type MessageSeenPayload = {
  messageId: string;
  senderId: string;
  receiverId: string;
  status: MessageStatus;
  deliveredAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
};

export type UserPresencePayload = {
  userId: string;
  status: UserStatus;
  lastSeen?: string | null;
};

export type TypingPayload = {
  senderId: string;
  receiverId: string;
};

export type SendMessagePayload = {
  receiverId: string;
  text: string;
  clientTempId?: string;
  messageType?: MediaType;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  fileSize?: number | null;
  voiceNoteDuration?: number | null;
  replyToMessageId?: string | null;
  forwardedFrom?: string;
};

export type MediaUploadResponse = {
  url: string;
  mediaType: UploadableMediaType;
  fileName: string;
  storedName: string;
  mimeType: string;
  size: number;
};

export type PendingMedia = {
  uri: string;
  messageType: UploadableMediaType;
  fileName: string;
  mimeType: string;
  size?: number | null;
  width?: number;
  height?: number;
  duration?: number | null;
};

export type StatusViewer = {
  userId: string;
  user?: User;
  viewedAt: string;
};

export type StatusItem = {
  id: string;
  userId: string;
  user?: User;
  type: StatusType;
  text: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  backgroundColor?: string;
  viewers: StatusViewer[];
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
};

export type StatusFeedEntry = {
  user: User;
  statuses: StatusItem[];
  latestStatusAt: string;
  hasUnviewed: boolean;
};

export type CallRecord = {
  id: string;
  callerId: string;
  receiverId: string;
  type: CallType;
  status: CallStatus;
  roomId: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  direction: CallDirection;
  contact?: User;
  createdAt: string;
  updatedAt?: string;
};

export type CallSignalPayload = {
  callId: string;
  roomId: string;
  receiverId: string;
  callerId?: string;
  senderId?: string;
  type?: CallType;
  offer?: unknown;
  answer?: unknown;
  candidate?: unknown;
  control?: {
    isMuted?: boolean;
    isSpeakerOn?: boolean;
    isVideoEnabled?: boolean;
  } | null;
};

export type SendMessageAck = {
  ok: boolean;
  message?: Message;
  error?: string;
};

export type MessageSeenAck = {
  ok: boolean;
  message?: MessageSeenPayload;
  messages?: MessageSeenPayload[];
  error?: string;
};

export type JoinUserAck = {
  ok: boolean;
  userId?: string;
  socketId?: string;
  error?: string;
};

export type SocketAck = {
  ok: boolean;
  error?: string;
};

export type CommunityGroup = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  communityId?: string | null;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  isAnnouncementGroup: boolean;
  inviteCode: string;
  inviteLink: string;
  lastActivityAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Community = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  creatorId: string;
  memberIds: string[];
  announcementGroupId?: string | null;
  announcementGroup?: Pick<CommunityGroup, "id" | "name" | "memberIds" | "isAnnouncementGroup"> | null;
  inviteCode: string;
  inviteLink: string;
  groupsCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AppRelease = {
  id: string;
  version: string;
  buildNumber: number;
  channel: string;
  platform: string;
  fileName?: string;
  checksumSha256?: string;
  fileSizeBytes?: number | null;
  appSizeLabel?: string;
  minimumSupportedBuildNumber: number;
  releaseNotes: string[];
  downloadCount: number;
  publishedAt: string;
  apkUrl: string;
  downloadUrl: string;
  relativeWebsiteDownloadPath?: string;
  isLatest: boolean;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
};
