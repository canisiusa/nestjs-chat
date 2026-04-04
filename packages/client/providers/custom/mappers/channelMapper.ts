import type { Channel } from '../../../core/types'
import { ChannelType } from '../../../core/types'
import type { RawCustomUser } from './userMapper'
import { mapCustomUser } from './userMapper'
import type { RawCustomMessage } from './messageMapper'
import { mapCustomMessage } from './messageMapper'

export interface RawCustomChannel {
  id: string
  tenantId?: string
  type?: string
  name?: string
  coverUrl?: string
  members?: RawCustomUser[]
  memberCount?: number
  unreadCount?: number
  lastMessage?: RawCustomMessage
  createdAt: string | number
  updatedAt?: string | number
  metadata?: Record<string, any>
  isFrozen?: boolean
  isCurrentUserMuted?: boolean
  myRole?: string
}

const toTimestamp = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? new Date(value).getTime() : value
}

const toRequiredTimestamp = (value: string | number): number => {
  return typeof value === 'string' ? new Date(value).getTime() : value
}

function resolveChannelType(raw: RawCustomChannel): ChannelType {
  if (!raw.type) return ChannelType.GROUP

  const normalized = raw.type.toUpperCase()
  if (normalized === 'DIRECT' || normalized === 'DM') return ChannelType.DIRECT
  return ChannelType.GROUP
}

export const mapCustomChannel = (raw: RawCustomChannel): Channel => {
  const members = (raw.members ?? []).map(mapCustomUser)
  const createdAt = toRequiredTimestamp(raw.createdAt)

  return {
    id: raw.id,
    type: resolveChannelType(raw),
    name: raw.name,
    coverUrl: raw.coverUrl,
    members,
    memberCount: raw.memberCount ?? members.length,
    unreadCount: raw.unreadCount ?? 0,
    lastMessage: raw.lastMessage
      ? mapCustomMessage(raw.lastMessage)
      : undefined,
    createdAt,
    updatedAt: toTimestamp(raw.updatedAt) ?? createdAt,
    metadata: raw.metadata,
    isFrozen: raw.isFrozen,
    isCurrentUserMuted: raw.isCurrentUserMuted,
    myRole: raw.myRole === 'operator' ? 'operator' : raw.myRole === 'member' ? 'member' : undefined,
  }
}
