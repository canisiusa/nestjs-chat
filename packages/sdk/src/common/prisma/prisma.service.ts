import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';
import { CHAT_MODULE_OPTIONS } from '../../core/tokens/injection-tokens';
import { ChatModuleOptions } from '../../chat-module-options';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(CHAT_MODULE_OPTIONS) options: ChatModuleOptions) {
    const adapter = new PrismaPg({ connectionString: options.database.url });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
