export interface User {
  id: string
  nickname: string
  profileUrl?: string
  metadata?: Record<string, string>
  lastSeenAt?: number
  isOnline?: boolean
  /** True if the user has left the ecosystem (metadata.status === 'left') */
  isDeleted?: boolean
}
