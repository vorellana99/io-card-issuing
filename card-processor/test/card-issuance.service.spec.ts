import { CardIssuanceService } from '../src/consumer/card-issuance.service';
import {
  CardRequestedPayload,
  EventTypes,
  KafkaTopics,
} from '../src/common/cloud-event';

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    SIMULATED_LATENCY_MIN_MS: 0,
    SIMULATED_LATENCY_MAX_MS: 0,
    SUCCESS_PROBABILITY: 1,
    ...overrides,
  };
  return { get: jest.fn((k: string) => values[k]) };
}

type PublishMock = jest.Mock<Promise<void>, [string, any]>;
type BuildMock = jest.Mock<any, [string, number, string, unknown]>;
interface PublisherMock {
  publish: PublishMock;
  buildEvent: BuildMock;
}

function makePublisher(): PublisherMock {
  return {
    publish: jest.fn(async (_topic: string, _event: any) => undefined) as PublishMock,
    buildEvent: jest.fn((source: string, id: number, type: string, data: unknown) => ({
      id,
      source,
      type,
      data,
    })) as BuildMock,
  };
}

function makeRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
}

const payload: CardRequestedPayload = {
  customer: {
    documentType: 'DNI',
    documentNumber: '11564321',
    fullName: 'Jose Pérez',
    age: 25,
    email: 'joseperez@example.com',
  },
  product: { type: 'VISA', currency: 'PEN' },
  forceError: false,
};

describe('CardIssuanceService', () => {
  it('usa valores por defecto cuando el config no provee las variables de simulación', async () => {
    const emptyConfig = { get: jest.fn().mockReturnValue(undefined) };
    const publisher = makePublisher();
    const repo = makeRepo();

    const service = new CardIssuanceService(emptyConfig as any, publisher as any, repo as any);

    // Solo verificamos que el servicio se construye sin lanzar
    expect(service).toBeInstanceOf(CardIssuanceService);
  });

  it('acepta payload sin forceError (undefined) y emite con éxito', async () => {
    const publisher = makePublisher();
    const repo = makeRepo();
    const service = new CardIssuanceService(makeConfig() as any, publisher as any, repo as any);
    const payloadSinForceError = { ...payload, forceError: undefined };

    await service.handle('source-0', payloadSinForceError);

    const [topic] = publisher.publish.mock.calls[0];
    expect(topic).toBe('io.cards.issued.v1');
  });

  it('en caso de éxito persiste y publica io.cards.issued.v1', async () => {
    const publisher = makePublisher();
    const repo = makeRepo();
    const service = new CardIssuanceService(makeConfig() as any, publisher as any, repo as any);

    await service.handle('source-1', payload);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const [topic, event] = publisher.publish.mock.calls[0];
    expect(topic).toBe(KafkaTopics.CARD_ISSUED);
    expect(event.type).toBe(EventTypes.CARD_ISSUED);
    expect(event.source).toBe('source-1');
    expect(event.id).toBe(2);
    expect(event.data.cardNumber).toMatch(/^4\d{15}$/);
    expect(event.data.expiry).toMatch(/^\d{2}\/\d{2}$/);
    expect(event.data.cvv).toMatch(/^\d{3}$/);
  });

  it('forceError=true agota reintentos y publica en DLQ con reason/attempts/payload', async () => {
    jest.useFakeTimers();
    try {
      const publisher = makePublisher();
      const repo = makeRepo();
      const service = new CardIssuanceService(
        makeConfig({ SUCCESS_PROBABILITY: 1 }) as any,
        publisher as any,
        repo as any,
      );

      const promise = service.handle('source-2', { ...payload, forceError: true });
      // Avanzar timers de los retries
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 10);
      await promise;

      expect(repo.save).not.toHaveBeenCalled();
      expect(publisher.publish).toHaveBeenCalledTimes(1);
      const [topic, event] = publisher.publish.mock.calls[0];
      expect(topic).toBe(KafkaTopics.CARD_REQUESTED_DLQ);
      expect(event.type).toBe(EventTypes.CARD_REQUESTED_DLQ);
      expect(event.source).toBe('source-2');
      expect(event.data.error.reason).toMatch(/forceError/);
      expect(event.data.error.attempts).toBe(3);
      expect(event.data.originalPayload.customer.documentNumber).toBe('11564321');
    } finally {
      jest.useRealTimers();
    }
  });

  it('cuando SUCCESS_PROBABILITY=0 igualmente publica en DLQ', async () => {
    jest.useFakeTimers();
    try {
      const publisher = makePublisher();
      const repo = makeRepo();
      const service = new CardIssuanceService(
        makeConfig({ SUCCESS_PROBABILITY: 0 }) as any,
        publisher as any,
        repo as any,
      );

      const promise = service.handle('source-3', payload);
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 10);
      await promise;

      const [topic] = publisher.publish.mock.calls[0];
      expect(topic).toBe(KafkaTopics.CARD_REQUESTED_DLQ);
    } finally {
      jest.useRealTimers();
    }
  });
});
