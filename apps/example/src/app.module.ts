import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from '@chat-service/sdk';
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

    ChatModule.forRoot({
      database: { url: process.env.CHAT_DATABASE_URL || process.env.DATABASE_URL || '' },
      redis: { url: process.env.REDIS_URL || '' },
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
