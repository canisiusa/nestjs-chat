import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { IChatProvider } from '../../core/interfaces/IChatProvider'
import type { User } from '../../core/types'
import { CustomChannelService } from './CustomChannelService'
import { CustomMessageService } from './CustomMessageService'
import { CustomUserService } from './CustomUserService'
import { CustomMediaService } from './CustomMediaService'
import { CustomSocketManager } from './CustomSocketManager'
import { mapCustomUser } from './mappers'
import { ChatError, ChatErrorCode } from '../../core/errors/ChatError'

export class CustomChatProvider implements IChatProvider {
  private httpClient!: AxiosInstance
  private socketManager!: CustomSocketManager
  private currentUserId: string | null = null
  private _currentUser: User | null = null
  private _channels?: CustomChannelService
  private _messages?: CustomMessageService
  private _users?: CustomUserService
  private _media?: CustomMediaService

  async initialize(baseUrl: string, userId: string, accessToken?: string): Promise<void> {
    try {
      this.httpClient = axios.create({
        baseURL: `${baseUrl}/chat`,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })

      this.socketManager = new CustomSocketManager()
      this.socketManager.connect(baseUrl, accessToken ?? '')

      this.currentUserId = userId

      this._channels = new CustomChannelService(this.httpClient, this.socketManager)
      this._messages = new CustomMessageService(this.httpClient, this.socketManager)
      this._users = new CustomUserService(this.httpClient)
      this._media = new CustomMediaService(this.httpClient)

      await this.fetchCurrentUser()
    } catch (error) {
      throw new ChatError(
        ChatErrorCode.CONNECTION_FAILED,
        'Failed to initialize custom chat provider',
        error
      )
    }
  }

  private async fetchCurrentUser(): Promise<User> {
    try {
      const { data } = await this.httpClient.get(`/users/${this.currentUserId}`)
      this._currentUser = mapCustomUser(data.data)
      return this._currentUser
    } catch (error) {
      throw new ChatError(
        ChatErrorCode.AUTH_FAILED,
        'Failed to fetch current user',
        error
      )
    }
  }

  async connect(): Promise<User> {
    if (!this._currentUser) {
      if (!this.currentUserId) {
        throw new ChatError(ChatErrorCode.NOT_CONNECTED, 'Chat not initialized')
      }
      return this.fetchCurrentUser()
    }
    return this._currentUser
  }

  async disconnect(): Promise<void> {
    try {
      this.socketManager?.disconnect()
      this._currentUser = null
      this.currentUserId = null
    } catch (error) {
      throw ChatError.fromError(error)
    }
  }

  isConnected(): boolean {
    return this.socketManager?.isConnected() ?? false
  }

  getCurrentUser(): User | null {
    return this._currentUser
  }

  get channels(): CustomChannelService {
    if (!this._channels) {
      throw new ChatError(ChatErrorCode.NOT_CONNECTED, 'Chat not initialized')
    }
    return this._channels
  }

  get messages(): CustomMessageService {
    if (!this._messages) {
      throw new ChatError(ChatErrorCode.NOT_CONNECTED, 'Chat not initialized')
    }
    return this._messages
  }

  get users(): CustomUserService {
    if (!this._users) {
      throw new ChatError(ChatErrorCode.NOT_CONNECTED, 'Chat not initialized')
    }
    return this._users
  }

  get media(): CustomMediaService {
    if (!this._media) {
      throw new ChatError(ChatErrorCode.NOT_CONNECTED, 'Chat not initialized')
    }
    return this._media
  }
}
