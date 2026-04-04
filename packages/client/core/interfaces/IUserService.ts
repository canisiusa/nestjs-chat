import type { User } from '../types'

export interface UserSearchQuery {
  next(): Promise<User[]>
  hasMore: boolean
}

export interface IUserService {
  getUser(userId: string): Promise<User>
  searchUsers(keyword: string, limit?: number): Promise<User[]>
  createUserSearchQuery(keyword: string, limit?: number): UserSearchQuery
  updateCurrentUser(data: Partial<User>): Promise<User>
  blockUser(userId: string): Promise<void>
  unblockUser(userId: string): Promise<void>
  getBlockedUsers(): Promise<User[]>
}
