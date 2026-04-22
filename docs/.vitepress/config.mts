import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'nestjs-chat',
  description: 'Real-time chat SDK for NestJS — Prisma + PostgreSQL + Socket.IO',
  base: '/nestjs-chat/',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Integration', link: '/integration/backend' },
      { text: 'API', link: '/api/rest-endpoints' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Contributing / Local Dev', link: '/guide/contributing' },
        ],
      },
      {
        text: 'Integration',
        items: [
          { text: 'Backend (SDK/Plugin)', link: '/integration/backend' },
          { text: 'Frontend (Provider)', link: '/integration/frontend' },
          { text: 'Adapter Example', link: '/integration/adapter-example' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'REST Endpoints', link: '/api/rest-endpoints' },
          { text: 'WebSocket Events', link: '/api/websocket-events' },
          { text: 'Error Codes', link: '/api/error-codes' },
          { text: 'Database Schema', link: '/api/database-schema' },
        ],
      },
    ],
    search: { provider: 'local' },
    footer: {
      message: 'MIT License',
    },
  },
});
