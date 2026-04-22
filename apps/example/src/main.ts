import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('chat');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Chat Service — Example App')
    .setDescription('Example integration of nestjs-chat')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs/api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Example app running on http://localhost:${port}/chat`);
  console.log(`Swagger docs on http://localhost:${port}/docs/api`);
}

bootstrap();
