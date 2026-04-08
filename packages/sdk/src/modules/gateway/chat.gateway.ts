import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { CHAT_ROOMS } from '../../core/constants/chat.constants';
import { CHAT_MODULE_OPTIONS } from '../../core/tokens/injection-tokens';
import { ChatModuleOptions } from '../../chat-module-options';

@WebSocketGateway({
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(CHAT_MODULE_OPTIONS) private readonly options: ChatModuleOptions,
  ) {}

  afterInit(server: Server) {
    // Attach Redis adapter for horizontal scaling
    // The server from a namespaced gateway is the Namespace, not the Server.
    // Access the parent server via server.server (Namespace → Server).
    try {
      const ioServer = (server as any).server ?? server;
      if (typeof ioServer.adapter !== 'function') {
        this.logger.warn('Socket.IO Redis adapter: server.adapter not available, skipping');
        return;
      }

      const pubClient = new Redis(this.options.redis.url);
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => this.logger.error('Redis pub client error', { error: err.message }));
      subClient.on('error', (err) => this.logger.error('Redis sub client error', { error: err.message }));

      ioServer.adapter(createAdapter(pubClient, subClient, { key: 'chat:socket.io' }) as any);
      this.logger.info('Socket.IO Redis adapter attached for horizontal scaling');
    } catch (error) {
      this.logger.error('Failed to attach Socket.IO Redis adapter, falling back to in-memory', {
        error: (error as Error).message,
      });
    }
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    const tenantId = client.handshake.auth?.tenantId;

    if (!userId) {
      this.logger.warn('Socket connection without userId', { socketId: client.id });
    }

    if (userId) {
      client.join(CHAT_ROOMS.user(userId));
    }
    if (tenantId) {
      client.join(CHAT_ROOMS.tenant(tenantId));
    }

    client.data = { userId, tenantId };
    this.logger.info('Socket connected', { socketId: client.id, userId, tenantId });
  }

  handleDisconnect(client: Socket) {
    this.logger.info('Socket disconnected', { socketId: client.id, userId: client.data?.userId });
  }

  @SubscribeMessage(ChatSocketEvent.JOIN_CHANNEL)
  handleJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string }) {
    client.join(CHAT_ROOMS.channel(data.channelId));
    this.logger.debug('Socket joined channel', {
      socketId: client.id,
      userId: client.data?.userId,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage(ChatSocketEvent.LEAVE_CHANNEL)
  handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    client.leave(CHAT_ROOMS.channel(data.channelId));
    this.logger.debug('Socket left channel', {
      socketId: client.id,
      userId: client.data?.userId,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage(ChatSocketEvent.TYPING_START)
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string }) {
    client.to(CHAT_ROOMS.channel(data.channelId)).emit(ChatSocketEvent.TYPING_STATUS, {
      channelId: data.channelId,
      userId: client.data.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage(ChatSocketEvent.TYPING_STOP)
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { channelId: string }) {
    client.to(CHAT_ROOMS.channel(data.channelId)).emit(ChatSocketEvent.TYPING_STATUS, {
      channelId: data.channelId,
      userId: client.data.userId,
      isTyping: false,
    });
  }

  emitToChannel(channelId: string, event: ChatSocketEvent, payload: unknown) {
    this.server.to(CHAT_ROOMS.channel(channelId)).emit(event, payload);
  }

  emitToUser(userId: string, event: ChatSocketEvent, payload: unknown) {
    this.server.to(CHAT_ROOMS.user(userId)).emit(event, payload);
  }

  emitToTenant(tenantId: string, event: ChatSocketEvent, payload: unknown) {
    this.server.to(CHAT_ROOMS.tenant(tenantId)).emit(event, payload);
  }
}
