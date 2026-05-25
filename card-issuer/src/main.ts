import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'card-issuer';
  const groupId = process.env.KAFKA_GROUP_ID ?? 'card-issuer-group';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { clientId, brokers },
      consumer: { groupId, allowAutoTopicCreation: true },
      subscribe: { fromBeginning: false },
    },
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Card Issuer API')
    .setDescription(
      'REST API para solicitar la emisión de tarjetas. Forma parte de un flujo event-driven: este servicio ' +
        'valida el payload y publica `io.card.requested.v1` en Kafka. El `card-processor` se encarga de la ' +
        'emisión asíncrona y publica el resultado en `io.cards.issued.v1` o en la DLQ.',
    )
    .setVersion('1.0.0')
    .addTag('Cards', 'Endpoints relacionados con la emisión de tarjetas')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: 2 },
  });

  await app.startAllMicroservices();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  app.get(Logger).log(`card-issuer escuchando en :${port}`);
  app.get(Logger).log(`Swagger UI disponible en http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fallo al iniciar card-issuer:', err);
  process.exit(1);
});
