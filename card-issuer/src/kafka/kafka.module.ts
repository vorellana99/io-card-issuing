import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventPublisherService,
  KAFKA_CLIENT,
  kafkaClientProvider,
} from './event-publisher.service';

@Module({
  providers: [
    {
      provide: KAFKA_CLIENT,
      inject: [ConfigService],
      useFactory: kafkaClientProvider,
    },
    EventPublisherService,
  ],
  exports: [EventPublisherService],
})
export class KafkaModule {}
