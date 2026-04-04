# Frontend Chat SDK

Self-contained frontend SDK for connecting any React/TypeScript app to the Chat Service backend.

Includes everything needed — core interfaces, types, error handling, and the provider implementation. Just copy the `frontend/` folder into your project.

## What's Included

```
frontend/
├── core/                           # Interfaces, types, errors (the contract)
│   ├── interfaces/
│   │   ├── IChatProvider.ts        # Main provider interface
│   │   ├── IChannelService.ts      # 49 methods + 17 real-time events
│   │   ├── IMessageService.ts      # 30 methods + 12 real-time events
│   │   ├── IUserService.ts         # 7 methods
│   │   └── IMediaService.ts        # 5 methods
│   ├── types/
│   │   ├── channel.types.ts        # Channel, ChannelType
│   │   ├── message.types.ts        # Message, MessageType, Poll, Reaction, etc.
│   │   ├── user.types.ts           # User
│   │   ├── media.types.ts          # MediaUploadOptions, MediaUploadResult
│   │   └── index.ts                # Barrel export
│   └── errors/
│       └── ChatError.ts            # ChatError, ChatErrorCode
│
└── providers/custom/               # The provider implementation
    ├── CustomChatProvider.ts        # IChatProvider — axios + Socket.IO
    ├── CustomChannelService.ts      # IChannelService — REST + events
    ├── CustomMessageService.ts      # IMessageService — REST + events
    ├── CustomUserService.ts         # IUserService — REST
    ├── CustomMediaService.ts        # IMediaService — file upload
    ├── CustomSocketManager.ts       # Socket.IO connection manager
    ├── index.ts
    └── mappers/                     # API response → domain types
        ├── channelMapper.ts
        ├── messageMapper.ts
        ├── userMapper.ts
        ├── pollMapper.ts
        └── index.ts
```

## Installation

### Option 1: Copy the whole folder

Copy the entire `packages/client/` folder into your project's chat feature:

```
your-app/src/features/chat/
├── core/                    # ← from frontend/core/
├── providers/
│   └── custom/              # ← from frontend/providers/custom/
├── components/              # Your own UI components
├── hooks/                   # Your own hooks
└── stores/                  # Your own stores
```

### Option 2: Copy just the provider (if you already have the interfaces)

If your project already defines `IChatProvider`, `IChannelService`, etc., just copy `frontend/providers/custom/` — the imports use relative paths that match the standard structure.

## Peer Dependencies

```bash
npm install axios socket.io-client
```

## Usage

```typescript
import { CustomChatProvider } from './providers/custom';

const provider = new CustomChatProvider();
await provider.initialize('http://localhost:3001', userId, accessToken);

// Channels
const channels = await provider.channels.getChannels();
const dm = await provider.channels.createDirectChannel(targetUserId);

// Messages
const messages = await provider.messages.getMessages({ channelId: dm.id });
await provider.messages.sendTextMessage(dm.id, 'Hello!');

// Real-time events
const unsubscribe = provider.messages.onMessageReceived((channel, message) => {
  console.log('New message in', channel.name, ':', message.text);
});

// Typing indicators
await provider.messages.startTyping(channelId);

// Cleanup
unsubscribe();
await provider.disconnect();
```

## Environment

```env
VITE_CHAT_API_URL=http://localhost:3001
```

```typescript
const baseUrl = import.meta.env.VITE_CHAT_API_URL;
await provider.initialize(baseUrl, userId, token);
```
