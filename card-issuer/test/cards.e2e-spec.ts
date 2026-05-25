/**
 * Tests e2e para card-issuer.
 *
 * Estrategia:
 * - Se levanta el AppModule completo con Test.createTestingModule().
 * - EventPublisherService se reemplaza por un mock: evita conectar a Kafka real.
 * - SQLite usa :memory: (variable de entorno seteada antes de que ConfigModule cargue el .env).
 * - No se llama a connectMicroservice/startAllMicroservices (eso está en main.ts, que no se ejecuta
 *   en tests). Los @EventPattern del ConsumerModule quedan registrados pero sin transport → ignorados.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { EventPublisherService } from '../src/kafka/event-publisher.service';

// Configurar SQLite en memoria antes de que ConfigModule cargue el .env.
// dotenv no sobreescribe variables ya seteadas en process.env.
process.env.SQLITE_PATH = ':memory:';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_PRETTY = 'false';

function makePublisherMock() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    buildEvent: jest.fn(
      (source: string, id: number, type: string, data: unknown) => ({
        id,
        source,
        type,
        data,
      }),
    ),
  };
}

function validPayload(documentNumber: string, forceError = false) {
  return {
    customer: {
      documentType: 'DNI',
      documentNumber,
      fullName: 'Ana García',
      age: 28,
      email: 'ana@example.com',
    },
    product: { type: 'VISA', currency: 'PEN' },
    forceError,
  };
}

describe('Cards (e2e)', () => {
  let app: INestApplication;
  let publisherMock: ReturnType<typeof makePublisherMock>;

  beforeAll(async () => {
    publisherMock = makePublisherMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EventPublisherService)
      .useValue(publisherMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /cards/issue ────────────────────────────────────────────────────

  describe('POST /cards/issue', () => {
    it('202 Accepted con payload válido y publica el evento en Kafka', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send(validPayload('12345678'));

      expect(res.status).toBe(202);
      expect(res.body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(res.body.status).toBe('PENDING');
      expect(publisherMock.publish).toHaveBeenCalledTimes(1);
      const [topic, event] = publisherMock.publish.mock.calls[0];
      expect(topic).toBe('io.card.requested.v1');
      expect(event.source).toBe(res.body.requestId);
      expect(event.data.customer.documentNumber).toBe('12345678');
    });

    it('202 con forceError:true y lo propaga al evento', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send(validPayload('87654321', true));

      expect(res.status).toBe(202);
      const [, event] = publisherMock.publish.mock.calls[0];
      expect(event.data.forceError).toBe(true);
    });

    it('400 Bad Request si el documentNumber no tiene 8 dígitos', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send(validPayload('123'));

      expect(res.status).toBe(400);
      expect(publisherMock.publish).not.toHaveBeenCalled();
    });

    it('400 Bad Request si el age es menor a 18', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send({
          ...validPayload('11223344'),
          customer: { ...validPayload('11223344').customer, age: 17 },
        });

      expect(res.status).toBe(400);
    });

    it('400 Bad Request si la currency no es PEN ni USD', async () => {
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send({
          ...validPayload('11223345'),
          product: { type: 'VISA', currency: 'EUR' },
        });

      expect(res.status).toBe(400);
    });

    it('409 Conflict si el documentNumber ya tiene una solicitud registrada', async () => {
      // El documentNumber '12345678' ya fue registrado en el primer test de esta suite.
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send(validPayload('12345678'));

      expect(res.status).toBe(409);
      expect(publisherMock.publish).not.toHaveBeenCalled();
    });
  });

  // ─── GET /cards/:requestId/status ────────────────────────────────────────

  describe('GET /cards/:requestId/status', () => {
    let createdRequestId: string;

    beforeAll(async () => {
      // Crear una solicitud para luego consultar su estado.
      const res = await request(app.getHttpServer())
        .post('/cards/issue')
        .send(validPayload('55556666'));
      createdRequestId = res.body.requestId;
    });

    it('200 con status PENDING recién emitido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cards/${createdRequestId}/status`);

      expect(res.status).toBe(200);
      expect(res.body.requestId).toBe(createdRequestId);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.updatedAt).toBeDefined();
    });

    it('404 Not Found si el requestId no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/cards/00000000-0000-0000-0000-000000000000/status');

      expect(res.status).toBe(404);
    });
  });
});
