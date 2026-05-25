# io-card-issuing

Sistema de emisión de tarjetas basado en eventos construido con NestJS, Kafka y SQLite — prueba técnica IO Neobanco.

## Arquitectura

El cliente HTTP interactúa únicamente con `card-issuer`. La emisión real de la tarjeta ocurre de forma asíncrona: `card-issuer` publica un evento en Kafka y `card-processor` lo procesa. Una vez que `card-processor` termina, publica el resultado de vuelta en Kafka y `card-issuer` lo consume para actualizar el estado de la solicitud.

```mermaid
sequenceDiagram
  autonumber
  actor Cliente
  participant Issuer as card-issuer<br/>(REST :3000)
  participant Kafka
  participant Processor as card-processor

  Cliente->>Issuer: POST /cards/issue
  Issuer-->>Cliente: 202 Accepted { requestId, status: PENDING }
  Issuer->>Kafka: publica io.card.requested.v1

  Kafka->>Processor: entrega io.card.requested.v1
  note over Processor: simula emisión<br/>reintenta hasta 3 veces

  alt éxito
    Processor->>Kafka: publica io.cards.issued.v1
    Kafka->>Issuer: entrega io.cards.issued.v1
    Issuer->>Issuer: status → ISSUED
  else fallo tras reintentos
    Processor->>Kafka: publica io.card.requested.v1.dlq
    Kafka->>Issuer: entrega io.card.requested.v1.dlq
    Issuer->>Issuer: status → FAILED
  end

  Cliente->>Issuer: GET /cards/:requestId/status
  Issuer-->>Cliente: 200 { requestId, status, updatedAt }
```

> Todos los eventos de un mismo flujo comparten el mismo `source` (= `requestId`), lo que permite trazarlos en logs y en Kafka UI.

| Servicio | Rol | HTTP | Kafka produce | Kafka consume | Persistencia |
|---|---|---|---|---|---|
| `card-issuer` | Admisión + consulta de estado | `:3000` | `io.card.requested.v1` | `io.cards.issued.v1`, `io.card.requested.v1.dlq` | SQLite `card_requests` |
| `card-processor` | Emisión + reintentos | — | `io.cards.issued.v1`, `io.card.requested.v1.dlq` | `io.card.requested.v1` | SQLite `cards` |

---

## Stack tecnológico y características

### Lenguaje y framework

- TypeScript 5 + NestJS 10
- Dos servicios Node.js independientes sin workspaces compartidos — cada uno es dueño de su propio contrato

### Mensajería event-driven

- Apache Kafka 3.8 en modo KRaft (sin Zookeeper), broker single-node
- KafkaJS como cliente en ambos servicios
- Envelope CloudEvents-style `{ id, source, type, data }` con headers `ce-id`, `ce-source`, `ce-type`
- `card-issuer` en modo híbrido HTTP + Kafka consumer (`connectMicroservice` + `startAllMicroservices`)
- `card-processor` como microservicio puro Kafka (`createMicroservice`)
- `ensureTopics` en el arranque del processor para evitar `UNKNOWN_TOPIC_OR_PARTITION` contra Kafka virgen

### Persistencia

- SQLite vía `better-sqlite3` — una base de datos por servicio, completamente independientes
- TypeORM como ORM con `synchronize: true`
- Unique constraint en `documentNumber` — un cliente, una sola tarjeta

### Validación

- `class-validator` + `class-transformer` en DTOs
- `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`
- Reglas de dominio: DNI exactamente 8 dígitos, age ≥ 18, producto VISA, currency PEN o USD

### Resiliencia y reintentos

- Backoff fijo: 1s / 2s / 4s, máximo 4 intentos (1 inicial + 3 retries)
- Dead Letter Queue en `io.card.requested.v1.dlq` cuando se agotan todos los reintentos
- El handler Kafka no relanza errores → el offset avanza siempre, evitando duplicación de reintentos
- `forceError: true` en el payload fuerza fallo determinístico en cada intento (útil para ejercitar el camino DLQ)

### Observabilidad y logging

- `nestjs-pino` (Pino estructurado) en ambos servicios
- `pino-pretty` en desarrollo, JSON plano en producción (contenedores)
- `source` (= `requestId`) como correlation ID presente en todos los logs del mismo flujo
- Kafka UI (`provectuslabs/kafka-ui`) en `localhost:8080` para inspección de tópicos, mensajes y consumer groups en tiempo real

### Documentación de API

- Swagger / OpenAPI vía `@nestjs/swagger`, disponible en `http://localhost:3000/docs`
- Ejemplos de request precargados en Swagger: happy path y camino DLQ (`forceError: true`)

### Testing

| Tipo | Servicio | Tests | Cobertura |
|---|---|---|---|
| Unitarios | card-issuer | 39 tests, 5 suites | 100% en archivos de negocio |
| Unitarios | card-processor | 31 tests, 5 suites | 100% en archivos de negocio |
| E2E | card-issuer | 8 casos | AppModule real + SQLite `:memory:` + Kafka mockeado |
| Integración | card-issuer | 4 casos | Stack Docker real, sin ningún mock |

- Framework: Jest + ts-jest con mocks manuales (sin `jest.mock` de módulos)
- Los tests e2e no requieren infraestructura externa — usan `Test.createTestingModule` con SQLite en memoria
- Los tests de integración ejercitan el flujo completo: HTTP → Kafka → card-processor → Kafka → card-issuer → SQLite

### Infraestructura

- Docker Compose con cuatro servicios: Kafka KRaft, kafka-ui, card-issuer y card-processor en red compartida
- Dockerfiles multi-stage (`node:20-alpine`) — `python3`, `make` y `g++` en el builder para compilar los bindings nativos de `better-sqlite3`
- Volúmenes nombrados para persistencia de SQLite entre reinicios de contenedores
- `depends_on: condition: service_healthy` garantiza que los servicios arrancan solo cuando Kafka está listo

---

## Levantar el entorno

### Stack completo en Docker (demo / entrega)

Levanta Kafka, kafka-ui, card-issuer y card-processor en contenedores:

```bash
docker compose up
```

> La primera vez construye las imágenes (~2 min). En ejecuciones siguientes usa la caché.

```bash
docker compose up --build   # forzar rebuild de las imágenes
docker compose up -d        # modo detached (background)
docker compose down         # detener y eliminar contenedores
```

**Servicios disponibles:**

| URL | Descripción |
|---|---|
| http://localhost:3000/docs | Swagger UI — card-issuer |
| http://localhost:3000/cards/issue | `POST` solicitar emisión de tarjeta |
| http://localhost:3000/cards/:requestId/status | `GET` consultar estado del flujo |
| http://localhost:8080 | kafka-ui — inspeccionar tópicos y mensajes |

**Prueba rápida:**

```bash
# 1. Solicitar emisión de tarjeta → devuelve requestId
curl -s -X POST http://localhost:3000/cards/issue \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "documentType": "DNI",
      "documentNumber": "12345678",
      "fullName": "Ana García",
      "age": 28,
      "email": "ana@example.com"
    },
    "product": { "type": "VISA", "currency": "PEN" },
    "forceError": false
  }' | jq

# 2. Consultar el estado del flujo (reemplazar <requestId> con el valor del paso anterior)
curl -s http://localhost:3000/cards/<requestId>/status | jq
```

> Esperar ~1-2 segundos entre ambos comandos para que el `card-processor` complete la emisión. El estado pasará de `PENDING` a `ISSUED`.


**Tests de integración con el stack real:**

```bash
# Con el stack corriendo
cd card-issuer && npm run test:integration

# Apuntar a otro entorno (staging, CI, etc.)
cd card-issuer && ISSUER_URL=http://staging:3000 npm run test:integration
```

Ejercita el flujo completo sin mocks: HTTP → Kafka → card-processor → Kafka → card-issuer → SQLite.

---

### Solo Kafka (desarrollo local)

Para desarrollar los servicios localmente con watch mode, levanta solo el broker:

```bash
docker compose up kafka
```

Luego, en terminales separadas:

```bash
# Terminal 1
cd card-issuer
cp .env.example .env   # solo la primera vez
npm install
npm run start:dev

# Terminal 2
cd card-processor
cp .env.example .env   # solo la primera vez
npm install
npm run start:dev
```

Los servicios locales conectan a Kafka via `localhost:9094` (valor por defecto en los `.env`).

---

## Tests

```bash
# Unitarios (card-issuer)
cd card-issuer && npm test

# Unitarios con coverage (card-issuer)
cd card-issuer && npm run test:cov

# E2E (card-issuer — no requiere Kafka)
cd card-issuer && npm run test:e2e

# Unitarios (card-processor)
cd card-processor && npm test

# Unitarios con coverage (card-processor)
cd card-processor && npm run test:cov
```

---

## Flujo de un request

1. `POST /cards/issue` → 202 Accepted `{ requestId, status: "PENDING" }`
2. card-issuer publica `io.card.requested.v1` en Kafka
3. card-processor consume el evento y reintenta hasta 4 veces (backoff 1s / 2s / 4s)
   - Éxito → publica `io.cards.issued.v1`
   - Fallo total → publica `io.card.requested.v1.dlq`
4. card-issuer consume el resultado y actualiza `card_requests.status` a `ISSUED` o `FAILED`
5. `GET /cards/:requestId/status` → 200 `{ requestId, status, updatedAt }`

### Forzar el camino DLQ

Enviar `forceError: true` en el payload hace que el processor falle en todos los intentos de forma determinística:

```json
{
  "customer": { "documentType": "DNI", "documentNumber": "22222222",
                "fullName": "Test DLQ", "age": 30, "email": "dlq@example.com" },
  "product": { "type": "VISA", "currency": "USD" },
  "forceError": true
}
```

---

## Tópicos Kafka

| Tópico | Publicado por | Consumido por |
|---|---|---|
| `io.card.requested.v1` | card-issuer | card-processor |
| `io.cards.issued.v1` | card-processor | card-issuer |
| `io.card.requested.v1.dlq` | card-processor | card-issuer |
