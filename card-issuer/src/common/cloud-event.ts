/**
 * Envelope basado en CloudEvents (campos mínimos del enunciado).
 * `id` es un contador por flujo de ejecución (no global).
 * `source` es un UUID compartido por todos los eventos del mismo flujo (correlation id).
 */
export interface CloudEvent<T = unknown> {
  id: number;
  source: string;
  type: string;
  data: T;
}

export function buildEvent<T>(
  source: string,
  id: number,
  type: string,
  data: T,
): CloudEvent<T> {
  return { id, source, type, data };
}

export const EventTypes = {
  CARD_REQUESTED: 'io.card.requested.v1',
  CARD_ISSUED: 'io.cards.issued.v1',
  CARD_REQUESTED_DLQ: 'io.card.requested.v1.dlq',
} as const;

export const KafkaTopics = {
  CARD_REQUESTED: 'io.card.requested.v1',
  CARD_ISSUED: 'io.cards.issued.v1',
  CARD_REQUESTED_DLQ: 'io.card.requested.v1.dlq',
} as const;
