/**
 * Envelope basado en CloudEvents. Duplicado intencionalmente respecto al
 * card-issuer para mantener el desacoplamiento entre servicios — cada servicio
 * es dueño de su propio contrato.
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

export interface CardRequestedPayload {
  customer: {
    documentType: 'DNI';
    documentNumber: string;
    fullName: string;
    age: number;
    email: string;
  };
  product: {
    type: 'VISA';
    currency: 'PEN' | 'USD';
  };
  forceError?: boolean;
}

export interface CardIssuedPayload {
  requestId: string;
  cardId: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholder: string;
  product: { type: 'VISA'; currency: 'PEN' | 'USD' };
}

export interface DlqPayload {
  error: { reason: string; attempts: number };
  originalPayload: CardRequestedPayload;
}
