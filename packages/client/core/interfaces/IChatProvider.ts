import type { User } from '../types'
import type { IChannelService } from './IChannelService'
import type { IMessageService } from './IMessageService'
import type { IUserService } from './IUserService'
import type { IMediaService } from './IMediaService'

export interface IChatProvider {
  initialize(appId: string, userId: string, accessToken?: string): Promise<void>
  connect(): Promise<User>
  disconnect(): Promise<void>
  isConnected(): boolean
  getCurrentUser(): User | null

  // Services
  channels: IChannelService
  messages: IMessageService
  users: IUserService
  media: IMediaService
}
