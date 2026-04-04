import type { Channel, Message, User, LinkMetadata, ScheduledMessage, ScheduledStatus, Poll } from '../types'

export interface MessageListQuery {
  channelId: string
  limit?: number
  reverse?: boolean
  includeMetaArray?: boolean
  includeReactions?: boolean
  includeThreadInfo?: boolean
  includeParentMessageInfo?: boolean
}

export interface MessageSearchQuery {
  channelId?: string // Optionnel : si absent = recherche globale dans tous les channels
  keyword: string
  limit?: number
  order?: 'score' | 'timestamp' // score = pertinence, timestamp = chronologique
  reverse?: boolean
  exactMatch?: boolean
  channelCustomTypes?: string[]
  messageTimestampFrom?: number
  messageTimestampTo?: number
}

export interface SendMessageOptions {
  mentionedUserIds?: string[]
  parentMessageId?: string
  metadata?: Record<string, any>
  linkMetadata?: LinkMetadata
  onProgress?: (progress: number) => void
  scheduledAt?: number // Timestamp Unix pour programmer l'envoi (optionnel)
}

export interface ScheduledMessageListQuery {
  channelId: string
  scheduledStatus?: ScheduledStatus[]
  order?: 'scheduled_at' | 'created_at'
  reverse?: boolean
  limit?: number
}

export interface IMessageService {
  // Récupération
  getMessages(query: MessageListQuery): Promise<Message[]>
  getMessage(channelId: string, messageId: string): Promise<Message>
  getThreadedMessages(channelId: string, parentMessageId: string): Promise<Message[]>

  // Recherche (optionnel - serveur Sendbird)
  searchMessages?(query: MessageSearchQuery): Promise<Message[]>

  // Envoi
  sendTextMessage(channelId: string, text: string, options?: SendMessageOptions): Promise<Message>
  sendFileMessage(
    channelId: string,
    file: File,
    options?: SendMessageOptions
  ): Promise<Message>

  // Mise à jour
  updateMessage(channelId: string, messageId: string, text: string): Promise<Message>
  deleteMessage(channelId: string, messageId: string): Promise<void>

  // Transfert
  forwardMessage(message: Message, targetChannelId: string): Promise<Message>

  // Messages programmés
  getScheduledMessages(query: ScheduledMessageListQuery): Promise<ScheduledMessage[]>
  updateScheduledMessage(
    channelId: string,
    scheduledMessageId: number,
    text: string,
    scheduledAt?: number
  ): Promise<ScheduledMessage>
  cancelScheduledMessage(channelId: string, scheduledMessageId: number): Promise<void>
  sendScheduledMessageNow(channelId: string, scheduledMessageId: number): Promise<Message>

  // Interactions
  addReaction(channelId: string, messageId: string, reactionKey: string): Promise<void>
  removeReaction(channelId: string, messageId: string, reactionKey: string): Promise<void>

  // État
  markAsRead(channelId: string, messageId: string): Promise<void>
  markAsDelivered(channelId: string, messageId: string): Promise<void>

  // Typing
  startTyping(channelId: string): Promise<void>
  stopTyping(channelId: string): Promise<void>

  // Real-time
  onMessageReceived(callback: (channel: Channel, message: Message) => void): () => void
  onMessageUpdated(callback: (channel: Channel, message: Message) => void): () => void
  onMessageDeleted(callback: (channelId: string, messageId: string) => void): () => void
  onReactionUpdated(callback: (channel: Channel, message: Message) => void): () => void
  onTypingStatusUpdated(callback: (channel: Channel, users: User[]) => void): () => void
  onReadReceiptUpdated(callback: (channel: Channel, message: Message) => void): () => void
  onPollVoted(callback: (channel: Channel, pollId: number, poll: Poll) => void): () => void
  onPollUpdated(callback: (channel: Channel, pollId: number, poll: Poll) => void): () => void
  onPollDeleted(callback: (channel: Channel, pollId: number) => void): () => void
  onPinnedMessageUpdated(callback: (channel: Channel) => void): () => void
  onMentionReceived(callback: (channel: Channel, message: Message) => void): () => void

  // Sondages
  createPoll(
    channelId: string,
    title: string,
    options: string[],
    allowMultipleVotes?: boolean,
    allowUserSuggestion?: boolean,
    closeAt?: number
  ): Promise<Message>
  votePoll(channelId: string, pollId: number, optionIds: number[]): Promise<Poll>
  getPoll?(channelId: string, pollId: number): Promise<Poll>
}
