/**
 * Tests de flujo completo contra el stack real.
 *
 * PREREQUISITO: el stack debe estar levantado antes de correr estos tests.
 *   docker compose up -d
 *   cd card-issuer && npm run test:integration
 *
 * A diferencia de los tests e2e (que mockean Kafka y usan SQLite en memoria),
 * aquí no hay ningún mock: el mensaje recorre HTTP → Kafka → card-processor →
 * Kafka → card-issuer → SQLite, y el test verifica el estado final persistido.
 *
 * ISSUER_URL permite apuntar a otro entorno:
 *   ISSUER_URL=http://staging:3000 npm run test:integration
 */

import request = require('supertest');

const BASE_URL = process.env.ISSUER_URL ?? 'http://localhost:3000';

/**
 * Genera un documentNumber único de 8 dígitos basado en timestamp + índice
 * para evitar conflictos 409 entre ejecuciones consecutivas.
 */
function uniqueDocNumber(suffix: number): string {
  const ts = String(Date.now()).slice(-6);
  return `${ts}${String(suffix).padStart(2, '0')}`;
}

function validPayload(documentNumber: string, forceError = false) {
  return {
    customer: {
      documentType: 'DNI',
      documentNumber,
      fullName: 'Integration Test',
      age: 30,
      email: 'integration@test.com',
    },
    product: { type: 'VISA', currency: 'PEN' },
    forceError,
  };
}

/**
 * Consulta GET /cards/:requestId/status cada 500ms hasta que el status
 * deja de ser PENDING o se agota el timeout.
 * Lanza si el timeout se alcanza sin converger.
 */
async function waitForStatus(
  requestId: string,
  timeoutMs = 12000,
): Promise<{ requestId: string; status: string; updatedAt: string }> {
  const interval = 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await request(BASE_URL).get(`/cards/${requestId}/status`);
    expect(res.status).toBe(200);

    if (res.body.status !== 'PENDING') {
      return res.body as { requestId: string; status: string; updatedAt: string };
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `Timeout: requestId ${requestId} no convergió en ${timeoutMs}ms — sigue en PENDING`,
  );
}

describe('Flujo completo (integration — requiere stack corriendo)', () => {
  describe('POST /cards/issue → GET /cards/:requestId/status', () => {
    it('flujo happy path: status converge a ISSUED', async () => {
      const docNumber = uniqueDocNumber(1);

      const issueRes = await request(BASE_URL)
        .post('/cards/issue')
        .send(validPayload(docNumber));

      expect(issueRes.status).toBe(202);
      expect(issueRes.body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(issueRes.body.status).toBe('PENDING');

      const final = await waitForStatus(issueRes.body.requestId);

      expect(final.status).toBe('ISSUED');
      expect(final.requestId).toBe(issueRes.body.requestId);
      expect(final.updatedAt).toBeDefined();
    });

    it('flujo DLQ: con forceError=true el status converge a FAILED', async () => {
      const docNumber = uniqueDocNumber(2);

      const issueRes = await request(BASE_URL)
        .post('/cards/issue')
        .send(validPayload(docNumber, true));

      expect(issueRes.status).toBe(202);

      const final = await waitForStatus(issueRes.body.requestId);

      expect(final.status).toBe('FAILED');
    });
  });

  describe('POST /cards/issue — validaciones HTTP', () => {
    it('409 Conflict si el documentNumber ya fue registrado', async () => {
      const docNumber = uniqueDocNumber(3);

      // Primera solicitud — debe aceptarse
      const first = await request(BASE_URL)
        .post('/cards/issue')
        .send(validPayload(docNumber));
      expect(first.status).toBe(202);

      // Segunda solicitud con el mismo documentNumber — debe rechazarse
      const second = await request(BASE_URL)
        .post('/cards/issue')
        .send(validPayload(docNumber));
      expect(second.status).toBe(409);
    });
  });

  describe('GET /cards/:requestId/status — validaciones HTTP', () => {
    it('404 Not Found si el requestId no existe', async () => {
      const res = await request(BASE_URL)
        .get('/cards/00000000-0000-0000-0000-000000000000/status');

      expect(res.status).toBe(404);
    });
  });
});
