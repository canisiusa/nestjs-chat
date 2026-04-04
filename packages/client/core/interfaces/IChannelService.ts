import type { Channel, User } from '../types'

export interface ChannelListQuery {
  limit?: number
  includeEmpty?: boolean
  order?: 'latest_last_message' | 'chronological'
}

export interface IChannelService {
  // Liste et recherche
  getChannels(query?: ChannelListQuery): Promise<Channel[]>
  getChannel(channelId: string): Promise<Channel>
  searchChannels(keyword: string): Promise<Channel[]>

  // Création
  createDirectChannel(userId: string): Promise<Channel>
  createGroupChannel(userIds: string[], name?: string, coverImage?: File): Promise<Channel>

  // Mise à jour
  updateChannel(channelId: string, data: Partial<Channel>): Promise<Channel>
  leaveChannel(channelId: string): Promise<void>
  deleteChannel(channelId: string): Promise<void>

  // Membres
  getMembers(channelId: string): Promise<User[]>
  inviteUsers(channelId: string, userIds: string[]): Promise<Channel>
  removeUser(channelId: string, userId: string): Promise<Channel>

  // Gestion des groupes
  updateChannelName(channelId: string, name: string): Promise<Channel>
  updateChannelCoverImage(channelId: string, file: File): Promise<Channel>
  getChannelOperators(channelId: string): Promise<User[]>
  addOperators(channelId: string, userIds: string[]): Promise<void>
  removeOperators(channelId: string, userIds: string[]): Promise<void>
  isOperator(channelId: string, userId: string): Promise<boolean>

  // État
  markAsRead(channelId: string): Promise<void>
  getUnreadCount(): Promise<number>

  // Paramètres de conversation - Notifications
  setMyPushTriggerOption(channelId: string, option: 'all' | 'mention_only' | 'off'): Promise<void>
  getMyPushTriggerOption(channelId: string): Promise<'all' | 'mention_only' | 'off'>
  setMyCountPreference(channelId: string, preference: 'all' | 'unread_message_count_only' | 'off'): Promise<void>
  getMyCountPreference(channelId: string): Promise<'all' | 'unread_message_count_only' | 'off'>

  // Paramètres de conversation - Modération
  muteChannel(channelId: string): Promise<void>
  unmuteChannel(channelId: string): Promise<void>
  isMuted(channelId: string): Promise<boolean>
  freezeChannel(channelId: string): Promise<void>
  unfreezeChannel(channelId: string): Promise<void>

  // Paramètres de conversation - Blocage (user-level)
  blockUser(userId: string): Promise<void>
  unblockUser(userId: string): Promise<void>
  getBlockedUserIds(): Promise<string[]>
  isUserBlocked(userId: string): Promise<boolean>

  // Paramètres de conversation - Bannissement (channel-level)
  banUser(channelId: string, userId: string, description?: string, seconds?: number): Promise<void>
  unbanUser(channelId: string, userId: string): Promise<void>
  isBanned(channelId: string, userId: string): Promise<boolean>
  getBannedUsers(channelId: string): Promise<User[]>

  // Paramètres de conversation - Mute membre (empêche d'envoyer des messages)
  muteUser(channelId: string, userId: string, seconds?: number): Promise<void>
  unmuteUser(channelId: string, userId: string): Promise<void>
  getMutedUsers(channelId: string): Promise<User[]>

  // Paramètres de conversation - Visibilité
  hideChannel(channelId: string, hidePreviousMessages?: boolean): Promise<void>
  unhideChannel(channelId: string): Promise<void>
  isChannelHidden(channelId: string): Promise<boolean>

  // Paramètres de conversation - Historique
  resetHistory(channelId: string): Promise<void>

  // Paramètres de conversation - Métadonnées
  createChannelMetaData(channelId: string, metaData: Record<string, string>): Promise<void>
  updateChannelMetaData(channelId: string, metaData: Record<string, string>): Promise<void>
  deleteChannelMetaData(channelId: string, key: string): Promise<void>
  getChannelMetaData(channelId: string): Promise<Record<string, string>>

  // Paramètres de conversation - Propriétés custom
  setChannelCustomType(channelId: string, customType: string): Promise<void>
  getChannelCustomType(channelId: string): Promise<string>

  // Paramètres de conversation - Épinglage de messages
  pinMessage(channelId: string, messageId: string): Promise<void>
  unpinMessage(channelId: string, messageId: string): Promise<void>
  getPinnedMessageIds(channelId: string): Promise<string[]>

  // Paramètres de conversation - Signalement
  reportChannel(channelId: string, category: string, description?: string): Promise<void>
  reportUser(userId: string, category: string, description?: string): Promise<void>

  // Paramètres de conversation - Médias partagés
  getSharedFiles(channelId: string, limit?: number): Promise<Array<{
    id: string
    url: string
    name: string
    type: string
    size: number
    createdAt: number
  }>>

  // Real-time
  onChannelChanged(callback: (channel: Channel) => void): () => void
  onChannelDeleted(callback: (channelId: string) => void): () => void
  onUserJoined(callback: (channel: Channel, user: User) => void): () => void
  onUserLeft(callback: (channel: Channel, user: User) => void): () => void
  onUnreadCountChanged(callback: (count: number) => void): () => void
  onChannelFrozen(callback: (channel: Channel) => void): () => void
  onChannelUnfrozen(callback: (channel: Channel) => void): () => void
  onChannelMuted(callback: (channel: Channel) => void): () => void
  onChannelUnmuted(callback: (channel: Channel) => void): () => void
  onMetaDataChanged(callback: (channel: Channel, metaData: Record<string, string>) => void): () => void

  // Member events
  onUserBanned(callback: (channel: Channel, user: User) => void): () => void
  onUserUnbanned(callback: (channel: Channel, user: User) => void): () => void
  onUserMuted(callback: (channel: Channel, user: User) => void): () => void
  onUserUnmuted(callback: (channel: Channel, user: User) => void): () => void
  onOperatorUpdated(callback: (channel: Channel, operators: User[]) => void): () => void

  // Channel visibility events
  onChannelHidden(callback: (channel: Channel) => void): () => void

  // Member count events
  onChannelMemberCountChanged(callback: (channels: Channel[]) => void): () => void
}
