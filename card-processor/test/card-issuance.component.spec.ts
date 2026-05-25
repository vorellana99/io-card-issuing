import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from '../src/cards/entities/card.entity';
import { CardIssuanceService } from '../src/consumer/card-issuance.service';
import { CardRequestedPayload, EventTypes, KafkaTopics } from '../src/common/cloud-event';
import { EventPublisherService } from '../src/kafka/event-publisher.service';

const payload: CardRequestedPayload = {
  customer: {
    documentType: 'DNI',
    documentNumber: '12345678',
    fullName: 'Test User',
    age: 30,
    email: 'test@example.com',
  },
  product: { type: 'VISA', currency: 'PEN' },
  forceError: false,
};

describe('CardIssuanceService — component (SQLite :memory:)', () => {
  let service: CardIssuanceService;
  let cardRepo: Repository<Card>;
  let publishMock: jest.Mock;
  let buildEventMock: jest.Mock;

  beforeAll(async () => {
    publishMock = jest.fn(async () => undefined);
    buildEventMock = jest.fn((source: string, id: number, type: string, data: unknown) => ({
      id,
      source,
      type,
      data,
    }));

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Card],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Card]),
      ],
      providers: [
        CardIssuanceService,
        {
          provide: EventPublisherService,
          useValue: { publish: publishMock, buildEvent: buildEventMock },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const values: Record<string, unknown> = {
                SIMULATED_LATENCY_MIN_MS: 0,
                SIMULATED_LATENCY_MAX_MS: 0,
                SUCCESS_PROBABILITY: 1,
              };
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(CardIssuanceService);
    cardRepo = module.get(getRepositoryToken(Card));
  });

  beforeEach(async () => {
    await cardRepo.clear();
    publishMock.mockClear();
    buildEventMock.mockClear();
  });

  it('primera llamada procesa y persiste la tarjeta', async () => {
    await service.handle('req-comp-1', payload);

    expect(publishMock).toHaveBeenCalledTimes(1);
    const [topic] = publishMock.mock.calls[0];
    expect(topic).toBe(KafkaTopics.CARD_ISSUED);

    const cards = await cardRepo.find();
    expect(cards).toHaveLength(1);
    expect(cards[0].requestId).toBe('req-comp-1');
  });

  it('segunda llamada con mismo source es descartada sin persistir ni publicar', async () => {
    // Primera llamada: flujo normal
    await service.handle('req-comp-2', payload);
    expect(publishMock).toHaveBeenCalledTimes(1);
    publishMock.mockClear();

    // Segunda llamada: debe ser ignorada por idempotencia
    await service.handle('req-comp-2', payload);
    expect(publishMock).not.toHaveBeenCalled();

    // Solo 1 tarjeta en la base de datos
    const cards = await cardRepo.find();
    expect(cards).toHaveLength(1);
    expect(cards[0].requestId).toBe('req-comp-2');
  });

  it('distintos source generan dos tarjetas independientes', async () => {
    await service.handle('req-comp-3a', payload);
    await service.handle('req-comp-3b', payload);

    const cards = await cardRepo.find();
    expect(cards).toHaveLength(2);
    expect(publishMock).toHaveBeenCalledTimes(2);
    const topics = publishMock.mock.calls.map(([t]) => t);
    expect(topics).toEqual([KafkaTopics.CARD_ISSUED, KafkaTopics.CARD_ISSUED]);
  });
});
