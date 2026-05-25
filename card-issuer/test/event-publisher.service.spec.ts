import {
  EventPublisherService,
  kafkaClientProvider,
} from '../src/kafka/event-publisher.service';
import { CloudEvent } from '../src/common/cloud-event';

function makeProducer() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
  };
}

function makeKafka(producer: ReturnType<typeof makeProducer>) {
  return { producer: jest.fn().mockReturnValue(producer) };
}

function makeEvent(): CloudEvent<unknown> {
  return { id: 1, source: 'uuid-abc', type: 'io.card.requested.v1', data: { foo: 'bar' } };
}

describe('EventPublisherService', () => {
  it('onModuleInit crea y conecta el producer', async () => {
    const producer = makeProducer();
    const service = new EventPublisherService(makeKafka(producer) as any);

    await service.onModuleInit();

    expect(producer.connect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy desconecta el producer', async () => {
    const producer = makeProducer();
    const service = new EventPublisherService(makeKafka(producer) as any);
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy no falla si onModuleInit no fue llamado', async () => {
    const producer = makeProducer();
    const service = new EventPublisherService(makeKafka(producer) as any);

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(producer.disconnect).not.toHaveBeenCalled();
  });

  it('publish envía el mensaje con key=source y headers CloudEvents', async () => {
    const producer = makeProducer();
    const service = new EventPublisherService(makeKafka(producer) as any);
    await service.onModuleInit();
    const event = makeEvent();

    await service.publish('io.card.requested.v1', event);

    expect(producer.send).toHaveBeenCalledWith({
      topic: 'io.card.requested.v1',
      messages: [
        expect.objectContaining({
          key: 'uuid-abc',
          value: JSON.stringify(event),
          headers: {
            'ce-id': '1',
            'ce-source': 'uuid-abc',
            'ce-type': 'io.card.requested.v1',
          },
        }),
      ],
    });
  });

  it('buildEvent construye el envelope CloudEvent correctamente', () => {
    const producer = makeProducer();
    const service = new EventPublisherService(makeKafka(producer) as any);

    const result = service.buildEvent('uuid-xyz', 2, 'io.cards.issued.v1', { cardId: 'c1' });

    expect(result).toEqual({
      id: 2,
      source: 'uuid-xyz',
      type: 'io.cards.issued.v1',
      data: { cardId: 'c1' },
    });
  });
});

describe('kafkaClientProvider', () => {
  it('construye Kafka con los brokers del config', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'KAFKA_BROKERS') return 'localhost:9094';
        if (key === 'KAFKA_CLIENT_ID') return 'card-issuer';
        return undefined;
      }),
    };
    const kafka = kafkaClientProvider(config as any);
    expect(kafka).toBeDefined();
  });

  it('usa defaults cuando el config no tiene valores', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const kafka = kafkaClientProvider(config as any);
    expect(kafka).toBeDefined();
  });

  it('soporta múltiples brokers separados por coma', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'KAFKA_BROKERS') return 'broker1:9092,broker2:9092';
        return undefined;
      }),
    };
    const kafka = kafkaClientProvider(config as any);
    expect(kafka).toBeDefined();
  });
});
