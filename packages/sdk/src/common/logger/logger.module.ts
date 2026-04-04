import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import { getRequestContext } from '../context/request-context';

const LOG_DIR = process.env.LOG_DIR || 'logs';

const injectRequestContext = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.requestId = ctx.requestId;
    if (ctx.userId) info.userId = info.userId ?? ctx.userId;
    if (ctx.tenantId) info.tenantId = info.tenantId ?? ctx.tenantId;
    if (ctx.method) info.method = info.method ?? ctx.method;
    if (ctx.path) info.path = info.path ?? ctx.path;
  }
  return info;
});

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      format: winston.format.combine(
        injectRequestContext(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, requestId, context, ...meta }) => {
              const rid = requestId ? `[${requestId}]` : '';
              const ctx = context ? `[${context}]` : '';
              const metaKeys = Object.keys(meta).filter((k) => !['stack'].includes(k));
              const metaStr = metaKeys.length
                ? ` ${JSON.stringify(Object.fromEntries(metaKeys.map((k) => [k, meta[k]])))}`
                : '';
              const stack = meta.stack ? `\n${meta.stack}` : '';
              return `${timestamp} ${level} ${rid}${ctx} ${message}${metaStr}${stack}`;
            }),
          ),
        }),

        new winston.transports.File({
          filename: path.join(LOG_DIR, 'errors.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          format: winston.format.json(),
        }),

        new winston.transports.File({
          filename: path.join(LOG_DIR, 'combined.log'),
          level: 'info',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          format: winston.format.json(),
        }),
      ],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
