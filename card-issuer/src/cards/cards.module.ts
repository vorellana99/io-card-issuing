import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../kafka/kafka.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CardRequest } from './entities/card-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CardRequest]), KafkaModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
