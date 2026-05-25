import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CardRequestedPayload, CloudEvent, KafkaTopics } from '../common/cloud-event';
import { CardIssuanceService } from './card-issuance.service';

@Controller()
export class CardRequestedController {
  private readonly logger = new Logger(CardRequestedController.name);

  constructor(private readonly issuance: CardIssuanceService) {}

  @EventPattern(KafkaTopics.CARD_REQUESTED)
  async onCardRequested(@Payload() raw: unknown): Promise<void> {
    const event = this.parseEvent(raw);
    if (!event) {
      this.logger.error({ msg: 'Mensaje descartado: envelope inválido', raw });
      return;
    }
    try {
      await this.issuance.handle(event.source, event.data);
    } catch (err) {
      // No re-lanzamos para no bloquear el group offset commit en KafkaJS.
      // Los errores recuperables se manejan dentro de issuance.handle con
      // la política de reintentos + DLQ.
      this.logger.error({
        msg: 'Fallo no manejado procesando evento',
        source: event.source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private parseEvent(raw: unknown): CloudEvent<CardRequestedPayload> | null {
    if (raw && typeof raw === 'object' && 'source' in raw && 'data' in raw) {
      return raw as CloudEvent<CardRequestedPayload>;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as CloudEvent<CardRequestedPayload>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
