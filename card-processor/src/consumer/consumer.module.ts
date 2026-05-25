import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Card } from '../cards/entities/card.entity';
import { KafkaModule } from '../kafka/kafka.module';
import { CardIssuanceService } from './card-issuance.service';
import { CardRequestedController } from './card-requested.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Card]), KafkaModule],
  controllers: [CardRequestedController],
  providers: [CardIssuanceService],
})
export class ConsumerModule {}
