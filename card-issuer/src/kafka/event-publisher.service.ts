import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { buildEvent, CloudEvent } from '../common/cloud-event';

export const KAFKA_CLIENT = Symbol('KAFKA_CLIENT');

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private producer!: Producer;

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: Kafka) {}

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
    await this.producer.connect();
    this.logger.log('Kafka producer conectado');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  async publish<T>(topic: string, event: CloudEvent<T>): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key: event.source,
          value: JSON.stringify(event),
          headers: {
            'ce-id': String(event.id),
            'ce-source': event.source,
            'ce-type': event.type,
          },
        },
      ],
    });
    this.logger.log({
      msg: 'Evento publicado',
      topic,
      source: event.source,
      type: event.type,
      eventId: event.id,
    });
  }

  buildEvent<T>(source: string, id: number, type: string, data: T): CloudEvent<T> {
    return buildEvent(source, id, type, data);
  }
}

export function kafkaClientProvider(configService: ConfigService): Kafka {
  const brokers = (configService.get<string>('KAFKA_BROKERS') ?? 'localhost:9094')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const clientId = configService.get<string>('KAFKA_CLIENT_ID') ?? 'card-issuer';
  return new Kafka({ brokers, clientId });
}
