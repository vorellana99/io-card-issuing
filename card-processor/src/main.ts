import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { KafkaTopics } from './common/cloud-event';

async function ensureTopics(brokers: string[], clientId: string): Promise<void> {
  const admin = new Kafka({ brokers, clientId: `${clientId}-admin` }).admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = [
      KafkaTopics.CARD_REQUESTED,
      KafkaTopics.CARD_ISSUED,
      KafkaTopics.CARD_REQUESTED_DLQ,
    ].filter((t) => !existing.has(t));
    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
        waitForLeaders: true,
      });
    }
  } finally {
    await admin.disconnect();
  }
}

async function bootstrap(): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'card-processor';
  const groupId = process.env.KAFKA_GROUP_ID ?? 'card-processor-group';

  await ensureTopics(brokers, clientId);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    bufferLogs: true,
    options: {
      client: { clientId, brokers },
      consumer: { groupId, allowAutoTopicCreation: true },
      producer: { allowAutoTopicCreation: true },
      subscribe: { fromBeginning: false },
    },
  });

  app.useLogger(app.get(Logger));

  await app.listen();
  app.get(Logger).log(`card-processor escuchando Kafka en [${brokers.join(',')}]`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fallo al iniciar card-processor:', err);
  process.exit(1);
});
