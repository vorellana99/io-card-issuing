import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { CardEventsController } from './card-events.controller';

@Module({
  imports: [CardsModule],
  controllers: [CardEventsController],
})
export class ConsumerModule {}
