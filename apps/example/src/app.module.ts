import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from 'nestjs-chat';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth.controller';
import { ExampleAuthGuard, ExampleUserExtractor, ExampleUserResolver } from './providers';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
class ExamplePrismaModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),

    ExamplePrismaModule,

    ChatModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        database: { url: config.get('CHAT_DATABASE_URL') || config.get('DATABASE_URL')! },
        redis: { url: config.get('REDIS_URL')! },
        logging: { level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug' },
      }),
      providers: {
        authGuard: ExampleAuthGuard,
        userExtractor: ExampleUserExtractor,
        userResolver: ExampleUserResolver,
      },
    }),
  ],
  controllers: [AuthController],
})
export class AppModule {}
