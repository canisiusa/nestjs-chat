import { io, Socket } from 'socket.io-client'

type Listener = (...args: any[]) => void

export class CustomSocketManager {
  private socket: Socket | null = null
  private listeners: Map<string, Set<Listener>> = new Map()

  connect(baseUrl: string, token: string): void {
    if (this.socket?.connected) return

    this.socket = io(`${baseUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    this.socket.on('connect', () => {
      console.debug('[CustomSocketManager] Connected:', this.socket?.id)
      this.reRegisterListeners()
    })

    this.socket.on('disconnect', (reason) => {
      console.debug('[CustomSocketManager] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('[CustomSocketManager] Connection error:', error.message)
    })
  }

  disconnect(): void {
    if (!this.socket) return

    this.socket.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
    this.listeners.clear()
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  emit(event: string, data?: unknown): void {
    if (!this.socket?.connected) {
      console.warn('[CustomSocketManager] Cannot emit, socket not connected')
      return
    }
    this.socket.emit(event, data)
  }

  on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    this.socket?.on(event, callback)

    return () => this.off(event, callback)
  }

  off(event: string, callback: Listener): void {
    this.listeners.get(event)?.delete(callback)
    this.socket?.off(event, callback)
  }

  joinChannel(channelId: string): void {
    this.emit('channel:join', { channelId })
  }

  leaveChannel(channelId: string): void {
    this.emit('channel:leave', { channelId })
  }

  private reRegisterListeners(): void {
    for (const [event, callbacks] of this.listeners) {
      for (const callback of callbacks) {
        this.socket?.on(event, callback)
      }
    }
  }
}
