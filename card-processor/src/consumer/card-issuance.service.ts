import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { generateCard } from '../cards/card-generator';
import { Card } from '../cards/entities/card.entity';
import {
  CardIssuedPayload,
  CardRequestedPayload,
  DlqPayload,
  EventTypes,
  KafkaTopics,
} from '../common/cloud-event';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { MAX_RETRIES, runWithRetries } from '../retry/retry.policy';

export class ExternalProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExternalProviderError';
  }
}

@Injectable()
export class CardIssuanceService {
  private readonly logger = new Logger(CardIssuanceService.name);
  private readonly minLatencyMs: number;
  private readonly maxLatencyMs: number;
  private readonly successProbability: number;

  constructor(
    private readonly config: ConfigService,
    private readonly publisher: EventPublisherService,
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
  ) {
    this.minLatencyMs = Number(this.config.get('SIMULATED_LATENCY_MIN_MS') ?? 200);
    this.maxLatencyMs = Number(this.config.get('SIMULATED_LATENCY_MAX_MS') ?? 500);
    this.successProbability = Number(this.config.get('SUCCESS_PROBABILITY') ?? 0.6);
  }

  async handle(source: string, payload: CardRequestedPayload): Promise<void> {
    this.logger.log({
      msg: 'Procesando solicitud de tarjeta',
      source,
      documentNumber: payload.customer.documentNumber,
      forceError: payload.forceError ?? false,
    });

    const result = await runWithRetries(
      (attempt) => this.attemptIssue(source, payload, attempt),
      ({ attempt, delayMs, error }) => {
        this.logger.warn({
          msg: 'Intento de emisión fallido',
          source,
          attempt,
          delayMs,
          error: error.message,
        });
      },
    );

    if (result.success && result.value) {
      const event = this.publisher.buildEvent(source, 2, EventTypes.CARD_ISSUED, result.value);
      await this.publisher.publish(KafkaTopics.CARD_ISSUED, event);
      this.logger.log({
        msg: 'Tarjeta emitida con éxito',
        source,
        cardId: result.value.cardId,
        attempts: result.attempts,
      });
      return;
    }

    const reason = result.error?.message ?? 'unknown';
    const dlq: DlqPayload = {
      error: { reason, attempts: MAX_RETRIES },
      originalPayload: payload,
    };
    const dlqEvent = this.publisher.buildEvent(source, 2, EventTypes.CARD_REQUESTED_DLQ, dlq);
    await this.publisher.publish(KafkaTopics.CARD_REQUESTED_DLQ, dlqEvent);
    this.logger.error({
      msg: 'Emisión fallida tras todos los reintentos — publicado a DLQ',
      source,
      attempts: result.attempts,
      reason,
    });
  }

  private async attemptIssue(
    source: string,
    payload: CardRequestedPayload,
    attempt: number,
  ): Promise<CardIssuedPayload> {
    await this.simulateExternalLoad();

    if (payload.forceError === true) {
      throw new ExternalProviderError('forceError=true forzó la falla');
    }

    const isSuccess = Math.random() < this.successProbability;
    if (!isSuccess) {
      throw new ExternalProviderError(`Proveedor rechazó la emisión (intento ${attempt})`);
    }

    const generated = generateCard();
    const cardId = uuidv4();

    const entity = this.cardRepo.create({
      cardId,
      requestId: source,
      cardNumber: generated.cardNumber,
      expiry: generated.expiry,
      cvv: generated.cvv,
      cardholder: payload.customer.fullName,
      productType: payload.product.type,
      productCurrency: payload.product.currency,
      status: 'ISSUED',
    });
    await this.cardRepo.save(entity);

    return {
      requestId: source,
      cardId,
      cardNumber: generated.cardNumber,
      expiry: generated.expiry,
      cvv: generated.cvv,
      cardholder: payload.customer.fullName,
      product: payload.product,
    };
  }

  private async simulateExternalLoad(): Promise<void> {
    const min = Math.min(this.minLatencyMs, this.maxLatencyMs);
    const max = Math.max(this.minLatencyMs, this.maxLatencyMs);
    const latency = randomInt(min, max + 1);
    await new Promise<void>((resolve) => setTimeout(resolve, latency));
  }
}
