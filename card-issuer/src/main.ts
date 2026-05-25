import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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
