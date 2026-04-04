import type { User } from './user.types'

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  ADMIN = 'admin',
  POLL = 'poll',
}

export enum ScheduledStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum PollStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export interface PollOption {
  id: string
  text: string
  voteCount: number
  votedUserIds: string[]
  createdAt?: number
  updatedAt?: number
}

export interface Poll {
  id: string
  title: string
  options: PollOption[]
  allowMultipleVotes: boolean
  allowUserSuggestion: boolean
  closeAt?: number
  status: PollStatus
  voterCount: number
  createdAt: number
  updatedAt?: number
  createdBy?: User
  /** IDs des options votées par l'utilisateur courant */
  votedPollOptionIds?: number[]
}

export interface MessageReaction {
  key: string
  userIds: string[]
  updatedAt: number
}

export interface LinkMetadata {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
}

export interface Message {
  id: string
  channelId: string
  type: MessageType
  text?: string
  sender: User
  createdAt: number
  updatedAt?: number

  // Media
  fileUrl?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  thumbnailUrl?: string

  // Relations
  parentMessageId?: string // Pour les réponses
  parentMessage?: Message
  threadInfo?: {
    replyCount: number
    lastRepliedAt: number
  }

  // Interactions
  reactions?: MessageReaction[]
  mentionedUsers?: User[]

  // État
  isDeleted?: boolean
  isEdited?: boolean
  isPinned?: boolean // Si le message est épinglé dans le canal
  isForwarded?: boolean // Si le message a été transféré
  isPending?: boolean // Si le message est en cours d'envoi (temp ID)
  readBy?: string[] // User IDs (legacy)
  deliveredTo?: string[] // User IDs (legacy)

  // Read receipts (Sendbird)
  readCount?: number // Nombre de membres ayant lu le message
  deliveryCount?: number // Nombre de membres ayant reçu le message

  // Messages programmés
  scheduledAt?: number // Timestamp Unix (millisecondes) pour l'envoi programmé
  scheduledStatus?: ScheduledStatus // État du message programmé
  scheduledMessageId?: number // ID Sendbird du message programmé

  // Prévisualisation de lien
  linkMetadata?: LinkMetadata

  // Metadata
  metadata?: Record<string, any>

  // Sondage
  poll?: Poll
}

export interface ScheduledMessage extends Message {
  scheduledAt: number
  scheduledStatus: ScheduledStatus
  scheduledMessageId: number
}
