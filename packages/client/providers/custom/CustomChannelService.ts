import type { AxiosInstance } from 'axios'
import type { IChannelService, ChannelListQuery } from '../../core/interfaces/IChannelService'
import type { Channel, User } from '../../core/types'
import type { CustomSocketManager } from './CustomSocketManager'
import { mapCustomChannel, mapCustomUser } from './mappers'
import { ChatError, ChatErrorCode } from '../../core/errors/ChatError'

export class CustomChannelService implements IChannelService {
  constructor(
    private readonly http: AxiosInstance,
    private readonly socket: CustomSocketManager
  ) {}

  // ---------------------------------------------------------------------------
  // Liste et recherche
  // ---------------------------------------------------------------------------

  async getChannels(query?: ChannelListQuery): Promise<Channel[]> {
    try {
      const { data } = await this.http.get('/channels', { params: query })
      return data.data.map(mapCustomChannel)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getChannel(channelId: string): Promise<Channel> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}`)
      return mapCustomChannel(data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.CHANNEL_NOT_FOUND, `Channel ${channelId} not found`, error)
    }
  }

  async searchChannels(keyword: string): Promise<Channel[]> {
    try {
      const { data } = await this.http.get('/channels/search', { params: { keyword } })
      return data.data.map(mapCustomChannel)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------------

  async createDirectChannel(userId: string): Promise<Channel> {
    try {
      const { data } = await this.http.post('/channels/direct', { userId })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.CHANNEL_CREATE_FAILED, 'Failed to create direct channel', error)
    }
  }

  async createGroupChannel(userIds: string[], name?: string, coverImage?: File): Promise<Channel> {
    try {
      const formData = new FormData()
      userIds.forEach((id) => formData.append('userIds[]', id))
      if (name) formData.append('name', name)
      if (coverImage) formData.append('coverImage', coverImage)

      const { data } = await this.http.post('/channels/group', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw new ChatError(ChatErrorCode.CHANNEL_CREATE_FAILED, 'Failed to create group channel', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Mise a jour
  // ---------------------------------------------------------------------------

  async updateChannel(channelId: string, updates: Partial<Channel>): Promise<Channel> {
    try {
      const { data } = await this.http.patch(`/channels/${channelId}`, updates)
      return mapCustomChannel(data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async leaveChannel(channelId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/leave`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Membres
  // ---------------------------------------------------------------------------

  async getMembers(channelId: string): Promise<User[]> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/members`)
      return data.data.map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async inviteUsers(channelId: string, userIds: string[]): Promise<Channel> {
    try {
      const { data } = await this.http.post(`/channels/${channelId}/invite`, { userIds })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async removeUser(channelId: string, userId: string): Promise<Channel> {
    try {
      const { data } = await this.http.post(`/channels/${channelId}/remove`, { userId })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Gestion des groupes
  // ---------------------------------------------------------------------------

  async updateChannelName(channelId: string, name: string): Promise<Channel> {
    try {
      const { data } = await this.http.patch(`/channels/${channelId}`, { name })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async updateChannelCoverImage(channelId: string, file: File): Promise<Channel> {
    try {
      const formData = new FormData()
      formData.append('coverImage', file)

      const { data } = await this.http.patch(`/channels/${channelId}/cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return mapCustomChannel(data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getChannelOperators(channelId: string): Promise<User[]> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/operators`)
      return data.data.map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async addOperators(channelId: string, userIds: string[]): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/operators`, { userIds })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async removeOperators(channelId: string, userIds: string[]): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/operators`, { data: { userIds } })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async isOperator(channelId: string, userId: string): Promise<boolean> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/operators/${userId}`)
      return data.data.isOperator
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Etat
  // ---------------------------------------------------------------------------

  async markAsRead(channelId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/read`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const { data } = await this.http.get('/channels/unread-count')
      return data.data.count
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  async setMyPushTriggerOption(channelId: string, option: 'all' | 'mention_only' | 'off'): Promise<void> {
    try {
      await this.http.put(`/channels/${channelId}/push-trigger`, { option })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getMyPushTriggerOption(channelId: string): Promise<'all' | 'mention_only' | 'off'> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/push-trigger`)
      return data.data.option
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async setMyCountPreference(channelId: string, preference: 'all' | 'unread_message_count_only' | 'off'): Promise<void> {
    try {
      await this.http.put(`/channels/${channelId}/count-preference`, { preference })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getMyCountPreference(channelId: string): Promise<'all' | 'unread_message_count_only' | 'off'> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/count-preference`)
      return data.data.preference
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Moderation - Mute channel
  // ---------------------------------------------------------------------------

  async muteChannel(channelId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/mute`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unmuteChannel(channelId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/mute`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async isMuted(channelId: string): Promise<boolean> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/mute`)
      return data.data.isMuted
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async freezeChannel(channelId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/freeze`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unfreezeChannel(channelId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/freeze`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Blocage (user-level)
  // ---------------------------------------------------------------------------

  async blockUser(userId: string): Promise<void> {
    try {
      await this.http.post(`/users/block`, { userId })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      await this.http.delete(`/users/block`, { data: { userId } })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getBlockedUserIds(): Promise<string[]> {
    try {
      const { data } = await this.http.get('/users/blocked')
      return data.data.userIds
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const { data } = await this.http.get(`/users/blocked/${userId}`)
      return data.data.isBlocked
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Bannissement (channel-level)
  // ---------------------------------------------------------------------------

  async banUser(channelId: string, userId: string, description?: string, seconds?: number): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/ban`, { userId, description, seconds })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unbanUser(channelId: string, userId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/ban/${userId}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async isBanned(channelId: string, userId: string): Promise<boolean> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/ban/${userId}`)
      return data.data.isBanned
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getBannedUsers(channelId: string): Promise<User[]> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/banned`)
      return data.data.map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Mute membre
  // ---------------------------------------------------------------------------

  async muteUser(channelId: string, userId: string, seconds?: number): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/mute-user`, { userId, seconds })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unmuteUser(channelId: string, userId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/mute-user/${userId}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getMutedUsers(channelId: string): Promise<User[]> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/muted-users`)
      return data.data.map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Visibilite
  // ---------------------------------------------------------------------------

  async hideChannel(channelId: string, hidePreviousMessages?: boolean): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/hide`, { hidePreviousMessages })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unhideChannel(channelId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/hide`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async isChannelHidden(channelId: string): Promise<boolean> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/hide`)
      return data.data.isHidden
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Historique
  // ---------------------------------------------------------------------------

  async resetHistory(channelId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/reset-history`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Metadonnees
  // ---------------------------------------------------------------------------

  async createChannelMetaData(channelId: string, metaData: Record<string, string>): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/metadata`, { metaData })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async updateChannelMetaData(channelId: string, metaData: Record<string, string>): Promise<void> {
    try {
      await this.http.put(`/channels/${channelId}/metadata`, { metaData })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async deleteChannelMetaData(channelId: string, key: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/metadata/${key}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getChannelMetaData(channelId: string): Promise<Record<string, string>> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/metadata`)
      return data.data
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Proprietes custom
  // ---------------------------------------------------------------------------

  async setChannelCustomType(channelId: string, customType: string): Promise<void> {
    try {
      await this.http.put(`/channels/${channelId}/custom-type`, { customType })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getChannelCustomType(channelId: string): Promise<string> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/custom-type`)
      return data.data.customType
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Epinglage de messages
  // ---------------------------------------------------------------------------

  async pinMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/pin`, { messageId })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unpinMessage(channelId: string, messageId: string): Promise<void> {
    try {
      await this.http.delete(`/channels/${channelId}/pin/${messageId}`)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getPinnedMessageIds(channelId: string): Promise<string[]> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/pinned`)
      return data.data.messageIds
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Signalement
  // ---------------------------------------------------------------------------

  async reportChannel(channelId: string, category: string, description?: string): Promise<void> {
    try {
      await this.http.post(`/channels/${channelId}/report`, { category, description })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async reportUser(userId: string, category: string, description?: string): Promise<void> {
    try {
      await this.http.post(`/users/${userId}/report`, { category, description })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Medias partages
  // ---------------------------------------------------------------------------

  async getSharedFiles(channelId: string, limit?: number): Promise<Array<{
    id: string
    url: string
    name: string
    type: string
    size: number
    createdAt: number
  }>> {
    try {
      const { data } = await this.http.get(`/channels/${channelId}/files`, {
        params: { limit },
      })
      return data.data
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  // ---------------------------------------------------------------------------
  // Real-time: Channel events
  // ---------------------------------------------------------------------------

  onChannelChanged(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:changed', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  onChannelDeleted(callback: (channelId: string) => void): () => void {
    return this.socket.on('chat:channel:deleted', (payload: { channelId: string }) => {
      callback(payload.channelId)
    })
  }

  onUserJoined(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_joined', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onUserLeft(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_left', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onUnreadCountChanged(callback: (count: number) => void): () => void {
    return this.socket.on('chat:channel:unread_count', (payload: { count: number }) => {
      callback(payload.count)
    })
  }

  onChannelFrozen(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:frozen', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  onChannelUnfrozen(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:unfrozen', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  onChannelMuted(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:muted', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  onChannelUnmuted(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:unmuted', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  onMetaDataChanged(callback: (channel: Channel, metaData: Record<string, string>) => void): () => void {
    return this.socket.on('chat:channel:metadata_changed', (payload: { channel: unknown; metaData: Record<string, string> }) => {
      callback(mapCustomChannel(payload.channel), payload.metaData)
    })
  }

  // ---------------------------------------------------------------------------
  // Real-time: Member events
  // ---------------------------------------------------------------------------

  onUserBanned(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_banned', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onUserUnbanned(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_unbanned', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onUserMuted(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_muted', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onUserUnmuted(callback: (channel: Channel, user: User) => void): () => void {
    return this.socket.on('chat:channel:user_unmuted', (payload: { channel: unknown; user: unknown }) => {
      callback(mapCustomChannel(payload.channel), mapCustomUser(payload.user))
    })
  }

  onOperatorUpdated(callback: (channel: Channel, operators: User[]) => void): () => void {
    return this.socket.on('chat:channel:operator_updated', (payload: { channel: unknown; operators: unknown[] }) => {
      callback(mapCustomChannel(payload.channel), payload.operators.map(mapCustomUser))
    })
  }

  // ---------------------------------------------------------------------------
  // Real-time: Channel visibility events
  // ---------------------------------------------------------------------------

  onChannelHidden(callback: (channel: Channel) => void): () => void {
    return this.socket.on('chat:channel:hidden', (payload: { channel: unknown }) => {
      callback(mapCustomChannel(payload.channel))
    })
  }

  // ---------------------------------------------------------------------------
  // Real-time: Member count events
  // ---------------------------------------------------------------------------

  onChannelMemberCountChanged(callback: (channels: Channel[]) => void): () => void {
    return this.socket.on('chat:channel:member_count_changed', (payload: { channels: unknown[] }) => {
      callback(payload.channels.map(mapCustomChannel))
    })
  }
}
