import type { AxiosInstance } from 'axios'
import type {
  IMessageService,
  MessageListQuery,
  MessageSearchQuery,
  SendMessageOptions,
  ScheduledMessageListQuery,
} from '../../core/interfaces/IMessageService'
import type { Channel, Message, User, ScheduledMessage, Poll } from '../../core/types'
import { mapCustomMessage, mapCustomChannel, mapCustomUser, mapCustomPoll } from './mappers'
import type { CustomSocketManager } from './CustomSocketManager'
import { ChatError, ChatErrorCode } from '../../core/errors/ChatError'

export class CustomMessageService implements IMessageService {
  private http: AxiosInstance
  private socket: CustomSocketManager

  constructor(http: AxiosInstance, socket: CustomSocketManager) {
    this.http = http
    this.socket = socket
  }

  async getMessages(query: MessageListQuery): Promise<Message[]> {
    try {
      const response = await this.http.get(`/channels/${query.channelId}/messages`, {
        params: {
          limit: query.limit ?? 50,
          reverse: query.reverse ?? true,
          includeReactions: query.includeReactions ?? true,
          includeThreadInfo: query.includeThreadInfo ?? true,
          includeParentMessageInfo: query.includeParentMessageInfo ?? true,
        },
      })
      return (response.data.data as any[]).map(mapCustomMessage)
    } catch (error) {
      throw new ChatError(ChatErrorCode.UNKNOWN_ERROR, 'Failed to fetch messages', error)
    }
  }

  async getMessage(channelId: string, messageId: string): Promise<Message> {
    try {
      const response = await this.http.get(`/channels/${channelId}/messages/${messageId}`)
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.MESSAGE_NOT_FOUND, `Message ${messageId} not found`, error)
    }
  }

  async getThreadedMessages(channelId: string, parentMessageId: string): Promise<Message[]> {
    try {
      const response = await this.http.get(
        `/channels/${channelId}/messages/${parentMessageId}/thread`
      )
      return (response.data.data as any[]).map(mapCustomMessage)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async searchMessages(query: MessageSearchQuery): Promise<Message[]> {
    try {
      const response = await this.http.post('/messages/search', {
        channelId: query.channelId,
        keyword: query.keyword,
        limit: query.limit ?? 20,
        order: query.order ?? 'score',
        reverse: query.reverse ?? false,
        exactMatch: query.exactMatch ?? false,
        channelCustomTypes: query.channelCustomTypes,
        messageTimestampFrom: query.messageTimestampFrom,
        messageTimestampTo: query.messageTimestampTo,
      })
      return (response.data.data as any[]).map(mapCustomMessage)
    } catch (error) {
      throw new ChatError(ChatErrorCode.UNKNOWN_ERROR, 'Failed to search messages', error)
    }
  }

  async sendTextMessage(
    channelId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<Message> {
    try {
      const response = await this.http.post(`/channels/${channelId}/messages`, {
        text,
        mentionedUserIds: options?.mentionedUserIds,
        parentMessageId: options?.parentMessageId,
        metadata: options?.metadata,
        linkMetadata: options?.linkMetadata,
        scheduledAt: options?.scheduledAt,
      })
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.MESSAGE_SEND_FAILED, 'Failed to send message', error)
    }
  }

  async sendFileMessage(
    channelId: string,
    file: File,
    options?: SendMessageOptions
  ): Promise<Message> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (options?.mentionedUserIds) {
        formData.append('mentionedUserIds', JSON.stringify(options.mentionedUserIds))
      }
      if (options?.parentMessageId) {
        formData.append('parentMessageId', options.parentMessageId)
      }
      if (options?.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata))
      }
      if (options?.scheduledAt) {
        formData.append('scheduledAt', String(options.scheduledAt))
      }

      const response = await this.http.post(`/channels/${channelId}/messages/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: options?.onProgress
          ? (progressEvent) => {
              const total = progressEvent.total ?? 0
              const percentage = total > 0 ? Math.round((progressEvent.loaded * 100) / total) : 0
              options.onProgress!(percentage)
            }
          : undefined,
      })
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.MESSAGE_SEND_FAILED, 'Failed to send file message', error)
    }
  }

  async updateMessage(channelId: string, messageId: string, text: string): Promise<Message> {
    try {
      const response = await this.http.patch(`/channels/${channelId}/messages/${messageId}`, {
        text,
      })
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/messages/${messageId}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async forwardMessage(message: Message, targetChannelId: string): Promise<Message> {
    try {
      const response = await this.http.post(
        `/channels/${message.channelId}/messages/${message.id}/forward`,
        { targetChannelId }
      )
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.MESSAGE_SEND_FAILED, 'Failed to forward message', error)
    }
  }

  async getScheduledMessages(query: ScheduledMessageListQuery): Promise<ScheduledMessage[]> {
    try {
      const response = await this.http.get(`/channels/${query.channelId}/scheduled-messages`, {
        params: {
          scheduledStatus: query.scheduledStatus,
          order: query.order ?? 'scheduled_at',
          reverse: query.reverse ?? false,
          limit: query.limit ?? 20,
        },
      })
      return (response.data.data as any[]).map(
        (raw: any) => mapCustomMessage(raw) as ScheduledMessage
      )
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async updateScheduledMessage(
    channelId: string,
    scheduledMessageId: number,
    text: string,
    scheduledAt?: number
  ): Promise<ScheduledMessage> {
    try {
      const response = await this.http.patch(
        `/channels/${channelId}/scheduled-messages/${scheduledMessageId}`,
        { text, scheduledAt }
      )
      return mapCustomMessage(response.data.data) as ScheduledMessage
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async cancelScheduledMessage(channelId: string, scheduledMessageId: number): Promise<void> {
    try {
      await this.http.delete(
        `/channels/${channelId}/scheduled-messages/${scheduledMessageId}`
      )
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async sendScheduledMessageNow(
    channelId: string,
    scheduledMessageId: number
  ): Promise<Message> {
    try {
      const response = await this.http.post(
        `/channels/${channelId}/scheduled-messages/${scheduledMessageId}/send-now`
      )
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async addReaction(channelId: string, messageId: string, reactionKey: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/messages/${messageId}/reactions`, {
        key: reactionKey,
      })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async removeReaction(channelId: string, messageId: string, reactionKey: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/messages/${messageId}/reactions`, {
        data: { key: reactionKey },
      })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async markAsRead(channelId: string, messageId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/messages/${messageId}/read`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async markAsDelivered(channelId: string, messageId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/messages/${messageId}/delivered`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async startTyping(channelId: string): Promise<void> {
    this.socket.emit('chat:typing:start', { channelId })
  }

  async stopTyping(channelId: string): Promise<void> {
    this.socket.emit('chat:typing:stop', { channelId })
  }

  // Real-time events

  onMessageReceived(callback: (channel: Channel, message: Message) => void): () => void {
    return this.socket.on('chat:message:received', (data: any) => {
      callback(mapCustomChannel(data.channel), mapCustomMessage(data.message))
    })
  }

  onMessageUpdated(callback: (channel: Channel, message: Message) => void): () => void {
    return this.socket.on('chat:message:updated', (data: any) => {
      callback(mapCustomChannel(data.channel), mapCustomMessage(data.message))
    })
  }

  onMessageDeleted(callback: (channelId: string, messageId: string) => void): () => void {
    return this.socket.on('chat:message:deleted', (data: any) => {
      callback(data.channelId, data.messageId)
    })
  }

  onReactionUpdated(callback: (channel: Channel, message: Message) => void): () => void {
    return this.socket.on('chat:reaction:updated', (data: any) => {
      callback(mapCustomChannel(data.channel), mapCustomMessage(data.message))
    })
  }

  onTypingStatusUpdated(callback: (channel: Channel, users: User[]) => void): () => void {
    return this.socket.on('chat:typing:updated', (data: any) => {
      callback(
        mapCustomChannel(data.channel),
        (data.users as any[]).map(mapCustomUser)
      )
    })
  }

  onReadReceiptUpdated(callback: (channel: Channel, message: Message) => void): () => void {
    return this.socket.on('chat:read-receipt:updated', (data: any) => {
      callback(mapCustomChannel(data.channel), mapCustomMessage(data.message))
    })
  }

  onPollVoted(callback: (channel: Channel, pollId: number, poll: Poll) => void): () => void {
    return this.socket.on('chat:poll:voted', (data: any) => {
      callback(mapCustomChannel(data.channel), data.pollId, mapCustomPoll(data.poll))
    })
  }

  onPollUpdated(callback: (channel: Channel, pollId: number, poll: Poll) => void): () => void {
    return this.socket.on('chat:poll:updated', (data: any) => {
      callback(mapCustomChannel(data.channel), data.pollId, mapCustomPoll(data.poll))
    })
  }

  onPollDeleted(callback: (channel: Channel, pollId: number) => void): () => void {
    return this.socket.on('chat:poll:deleted', (data: any) => {
      callback(mapCustomChannel(data.channel), data.pollId)
    })
  }

  onPinnedMessageUpdated(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:pinned-message:updated', (data: any) => {
      callback(mapCustomChannel(data.channel))
    })
  }

  onMentionReceived(callback: (channel: Channel, message: Message) => void): () => void {
    return this.socket.on('chat:mention:received', (data: any) => {
      callback(mapCustomChannel(data.channel), mapCustomMessage(data.message))
    })
  }

  // Polls

  async createPoll(
    channelId: string,
    title: string,
    options: string[],
    allowMultipleVotes = false,
    allowUserSuggestion = false,
    closeAt?: number
  ): Promise<Message> {
    try {
      const response = await this.http.post(`/channels/${channelId}/polls`, {
        title,
        options,
        allowMultipleVotes,
        allowUserSuggestion,
        closeAt,
      })
      return mapCustomMessage(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.UNKNOWN_ERROR, 'Failed to create poll', error)
    }
  }

  async votePoll(channelId: string, pollId: number, optionIds: number[]): Promise<Poll> {
    try {
      const response = await this.http.post(`/channels/${channelId}/polls/${pollId}/vote`, {
        optionIds,
      })
      return mapCustomPoll(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.UNKNOWN_ERROR, 'Failed to vote on poll', error)
    }
  }

  async getPoll(channelId: string, pollId: number): Promise<Poll> {
    try {
      const response = await this.http.get(`/channels/${channelId}/polls/${pollId}`)
      return mapCustomPoll(response.data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.UNKNOWN_ERROR, 'Failed to get poll', error)
    }
  }
}
