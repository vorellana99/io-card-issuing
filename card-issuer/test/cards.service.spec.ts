import { ConflictException } from '@nestjs/common';
import { CardsService } from '../src/cards/cards.service';
import { CardRequest } from '../src/cards/entities/card-request.entity';
import { IssueCardRequestDto } from '../src/cards/dto/issue-card-request.dto';
import { EventTypes, KafkaTopics } from '../src/common/cloud-event';

type AnyRepo = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeRepo(initial: CardRequest[] = []): AnyRepo {
  const store = new Map<string, CardRequest>(initial.map((r) => [r.documentNumber, r]));
  return {
    findOne: jest.fn(async ({ where }: any) => store.get(where.documentNumber) ?? null),
    create: jest.fn((data: CardRequest) => data),
    save: jest.fn(async (entity: CardRequest) => {
      store.set(entity.documentNumber, entity);
      return entity;
    }),
  };
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

function validDto(overrides: Partial<IssueCardRequestDto['customer']> = {}): IssueCardRequestDto {
  return {
    customer: {
      documentType: 'DNI',
      documentNumber: '11564321',
      fullName: 'Jose Pérez',
      age: 25,
      email: 'joseperez@example.com',
      ...overrides,
    },
    product: { type: 'VISA', currency: 'PEN' },
    forceError: false,
  } as IssueCardRequestDto;
}

describe('CardsService', () => {
  it('emite con éxito, persiste y publica al topic correcto', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const service = new CardsService(repo as any, publisher as any);

    const result = await service.issue(validDto());

    expect(result.status).toBe('PENDING');
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledTimes(1);

    const [topic, event] = publisher.publish.mock.calls[0];
    expect(topic).toBe(KafkaTopics.CARD_REQUESTED);
    expect(event.type).toBe(EventTypes.CARD_REQUESTED);
    expect(event.id).toBe(1);
    expect(event.source).toBe(result.requestId);
    expect(event.data.customer.documentNumber).toBe('11564321');
  });

  it('rechaza con 409 si el documentNumber ya tiene una solicitud previa', async () => {
    const existing: CardRequest = {
      requestId: 'previo',
      documentNumber: '11564321',
      fullName: 'X',
      email: 'x@x.com',
      age: 30,
      productType: 'VISA',
      productCurrency: 'PEN',
      forceError: false,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = makeRepo([existing]);
    const publisher = makePublisher();
    const service = new CardsService(repo as any, publisher as any);

    await expect(service.issue(validDto())).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('propaga forceError al evento', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const service = new CardsService(repo as any, publisher as any);

    await service.issue({ ...validDto(), forceError: true });

    const [, event] = publisher.publish.mock.calls[0];
    expect(event.data.forceError).toBe(true);
  });
});
