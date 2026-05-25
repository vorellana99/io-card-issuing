import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CloudEvent, KafkaTopics } from '../common/cloud-event';
import { CardsService } from '../cards/cards.service';

@Controller()
export class CardEventsController {
  private readonly logger = new Logger(CardEventsController.name);

  constructor(private readonly cardsService: CardsService) {}

  @EventPattern(KafkaTopics.CARD_ISSUED)
  async onCardIssued(@Payload() raw: unknown): Promise<void> {
    const event = this.parseEnvelope(raw);
    if (!event) {
      this.logger.error({ msg: 'Mensaje descartado: envelope inválido', topic: KafkaTopics.CARD_ISSUED, raw });
      return;
    }
    try {
      await this.cardsService.updateStatus(event.source, 'ISSUED');
    } catch (err) {
      // No re-lanzamos: el offset avanza y evitamos reprocessing infinito.
      this.logger.error({
        msg: 'Error actualizando estado a ISSUED',
        source: event.source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  @EventPattern(KafkaTopics.CARD_REQUESTED_DLQ)
  async onCardDlq(@Payload() raw: unknown): Promise<void> {
    const event = this.parseEnvelope(raw);
    if (!event) {
      this.logger.error({ msg: 'Mensaje descartado: envelope inválido', topic: KafkaTopics.CARD_REQUESTED_DLQ, raw });
      return;
    }
    try {
      await this.cardsService.updateStatus(event.source, 'FAILED');
    } catch (err) {
      this.logger.error({
        msg: 'Error actualizando estado a FAILED',
        source: event.source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private parseEnvelope(raw: unknown): CloudEvent<unknown> | null {
    if (raw && typeof raw === 'object' && 'source' in raw) {
      return raw as CloudEvent<unknown>;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as CloudEvent<unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
