import type { User } from '../../../core/types'

export interface RawCustomUser {
  id: string
  nickname: string
  profileUrl?: string
  metadata?: Record<string, string>
  isOnline?: boolean
  lastSeenAt?: string | number
}

export const mapCustomUser = (raw: RawCustomUser): User => {
  const metadata = raw.metadata ?? undefined

  return {
    id: raw.id,
    nickname: raw.nickname || raw.id,
    profileUrl: raw.profileUrl,
    metadata,
    isOnline: raw.isOnline ?? false,
    lastSeenAt: raw.lastSeenAt
      ? typeof raw.lastSeenAt === 'string'
        ? new Date(raw.lastSeenAt).getTime()
        : raw.lastSeenAt
      : undefined,
    isDeleted: metadata?.status === 'left',
  }
}
