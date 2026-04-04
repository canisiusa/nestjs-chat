import type { User } from './user.types'
import type { Message } from './message.types'

/**
 * Type de canal de conversation
 *
 * DIRECT: Conversation privée entre 2 utilisateurs (isDistinct = true dans Sendbird)
 * GROUP: Groupe de discussion avec nom et plusieurs membres (isDistinct = false dans Sendbird)
 *
 * Note: Le type est déterminé par la propriété isDistinct de Sendbird,
 * PAS par le nombre de membres (un groupe peut avoir 2 membres)
 */
export enum ChannelType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export interface Channel {
  id: string
  type: ChannelType
  name?: string
  coverUrl?: string
  members: User[]
  memberCount: number
  unreadCount: number
  lastMessage?: Message
  createdAt: number
  updatedAt: number
  metadata?: Record<string, any>
  isFrozen?: boolean
  isCurrentUserMuted?: boolean
  myRole?: 'operator' | 'member'
}
