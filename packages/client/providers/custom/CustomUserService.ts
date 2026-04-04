import type { AxiosInstance } from 'axios'
import type { IUserService, UserSearchQuery } from '../../core/interfaces/IUserService'
import type { User } from '../../core/types'
import { mapCustomUser } from './mappers'
import { ChatError, ChatErrorCode } from '../../core/errors/ChatError'

export class CustomUserService implements IUserService {
  private http: AxiosInstance

  constructor(http: AxiosInstance) {
    this.http = http
  }

  async getUser(userId: string): Promise<User> {
    try {
      const response = await this.http.get(`/users/${userId}`)
      return mapCustomUser(response.data.data)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async searchUsers(keyword: string, limit?: number): Promise<User[]> {
    try {
      const response = await this.http.get('/users/search', {
        params: { keyword, limit: limit ?? 20 },
      })
      return (response.data.data as any[]).map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  createUserSearchQuery(keyword: string, limit?: number): UserSearchQuery {
    const pageSize = limit ?? 20
    let cursor: string | undefined
    let finished = false

    const http = this.http

    return {
      get hasMore() {
        return !finished
      },
      async next(): Promise<User[]> {
        if (finished) return []

        try {
          const response = await http.get('/users/search', {
            params: { keyword, limit: pageSize, cursor },
          })
          const { data: users, nextCursor } = response.data.data as {
            data: any[]
            nextCursor?: string
          }

          if (!nextCursor || users.length < pageSize) {
            finished = true
          }
          cursor = nextCursor

          return users.map(mapCustomUser)
        } catch (error) {
          finished = true
          throw ChatError.fromError(error)
        }
      },
    }
  }

  async updateCurrentUser(_data: Partial<User>): Promise<User> {
    throw new ChatError(
      ChatErrorCode.UNKNOWN_ERROR,
      'updateCurrentUser is not implemented in the backend yet'
    )
  }

  async blockUser(userId: string): Promise<void> {
    try {
      await this.http.post('/users/block', { userId })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async unblockUser(userId: string): Promise<void> {
    try {
      await this.http.post('/users/unblock', { userId })
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  async getBlockedUsers(): Promise<User[]> {
    try {
      const response = await this.http.get('/users/blocked')
      return (response.data.data as any[]).map(mapCustomUser)
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }
}
