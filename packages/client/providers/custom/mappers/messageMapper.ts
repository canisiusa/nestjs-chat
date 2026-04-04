import type { Message, MessageReaction, LinkMetadata } from '../../../core/types'
import { MessageType } from '../../../core/types'
import type { RawCustomUser } from './userMapper'
import { mapCustomUser } from './userMapper'
import type { RawCustomPoll } from './pollMapper'
import { mapCustomPoll } from './pollMapper'

export interface RawCustomMessage {
  id: string
  channelId: string
  type?: string
  text?: string
  sender?: RawCustomUser
  createdAt: string | number
  updatedAt?: string | number

  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string

  parentMessageId?: string
  parentMessage?: RawCustomMessage
  threadInfo?: {
    replyCount: number
    lastRepliedAt: string | number
  }

  reactions?: Array<{
    key: string
    userIds: string[]
    count?: number
    updatedAt?: string | number
  }>
  mentionedUsers?: RawCustomUser[]

  isDeleted?: boolean
  isEdited?: boolean
  isPinned?: boolean
  isForwarded?: boolean

  readCount?: number
  deliveryCount?: number

  scheduledAt?: string | number
  scheduledStatus?: string
  scheduledMessageId?: number

  linkMetadata?: LinkMetadata

  metadata?: Record<string, any>

  poll?: RawCustomPoll
}

const toTimestamp = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? new Date(value).getTime() : value
}

const toRequiredTimestamp = (value: string | number): number => {
  return typeof value === 'string' ? new Date(value).getTime() : value
}

function resolveMessageType(raw: RawCustomMessage): MessageType {
  if (raw.poll) return MessageType.POLL

  if (raw.type) {
    const normalized = raw.type.toLowerCase()
    if (normalized === 'admin') return MessageType.ADMIN
    if (normalized === 'image') return MessageType.IMAGE
    if (normalized === 'video') return MessageType.VIDEO
    if (normalized === 'audio') return MessageType.AUDIO
    if (normalized === 'file') return MessageType.FILE
    if (normalized === 'poll') return MessageType.POLL
    if (normalized === 'text') return MessageType.TEXT
  }

  if (raw.mimeType) {
    if (raw.mimeType.startsWith('image/')) return MessageType.IMAGE
    if (raw.mimeType.startsWith('video/')) return MessageType.VIDEO
    if (raw.mimeType.startsWith('audio/')) return MessageType.AUDIO
    if (raw.fileUrl) return MessageType.FILE
  }

  if (raw.fileUrl) return MessageType.FILE

  return MessageType.TEXT
}

export const mapCustomMessage = (raw: RawCustomMessage): Message => {
  const createdAt = toRequiredTimestamp(raw.createdAt)
  const updatedAt = toTimestamp(raw.updatedAt)

  const reactions: MessageReaction[] | undefined = raw.reactions?.map((r) => ({
    key: r.key,
    userIds: r.userIds ?? [],
    updatedAt: toTimestamp(r.updatedAt) ?? createdAt,
  }))

  const threadInfo = raw.threadInfo
    ? {
        replyCount: raw.threadInfo.replyCount,
        lastRepliedAt: toRequiredTimestamp(raw.threadInfo.lastRepliedAt),
      }
    : undefined

  const sender = raw.sender
    ? mapCustomUser(raw.sender)
    : { id: 'system', nickname: 'System', profileUrl: '' }

  return {
    id: raw.id,
    channelId: raw.channelId,
    type: resolveMessageType(raw),
    text: raw.text,
    sender,
    createdAt,
    updatedAt,

    fileUrl: raw.fileUrl,
    fileName: raw.fileName,
    fileSize: raw.fileSize,
    mimeType: raw.mimeType,
    thumbnailUrl: raw.thumbnailUrl,

    parentMessageId: raw.parentMessageId,
    parentMessage: raw.parentMessage
      ? mapCustomMessage(raw.parentMessage)
      : undefined,
    threadInfo,

    reactions,
    mentionedUsers: raw.mentionedUsers?.map(mapCustomUser),

    isDeleted: raw.isDeleted ?? false,
    isEdited: raw.isEdited ?? (updatedAt !== undefined && updatedAt !== createdAt),
    isPinned: raw.isPinned,
    isForwarded: raw.isForwarded,

    readCount: raw.readCount,
    deliveryCount: raw.deliveryCount,

    scheduledAt: toTimestamp(raw.scheduledAt),
    scheduledStatus: raw.scheduledStatus as Message['scheduledStatus'],
    scheduledMessageId: raw.scheduledMessageId,

    linkMetadata: raw.linkMetadata,
    metadata: raw.metadata,

    poll: raw.poll ? mapCustomPoll(raw.poll) : undefined,
  }
}
