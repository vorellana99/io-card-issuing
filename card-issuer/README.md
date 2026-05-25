# card-issuer

API REST construida con NestJS que actúa como puerta de entrada al sistema de emisión de tarjetas. Recibe solicitudes HTTP, las valida, las persiste en SQLite (`card_requests`) y publica el evento `io.card.requested.v1` en Kafka para que `card-processor` realice la emisión real de forma asíncrona.

Además actúa como **consumer Kafka**: escucha los tópicos `io.cards.issued.v1` y `io.card.requested.v1.dlq` para actualizar el estado de cada solicitud a `ISSUED` o `FAILED`.

**Puerto:** `3000` — **Stack:** NestJS · KafkaJS · TypeORM · SQLite · Pino

---

## Variables de entorno

Copia `.env.example` como punto de partida:

```bash
cp .env.example .env
```

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP del servicio |
| `NODE_ENV` | `development` | Entorno de ejecución |
| `LOG_LEVEL` | `debug` | Nivel de log (`debug`, `info`, `warn`, `error`) |
| `LOG_PRETTY` | `true` | Logs formateados en consola (`false` en producción) |
| `KAFKA_BROKERS` | `localhost:9094` | Bootstrap servers de Kafka (separados por coma) |
| `KAFKA_CLIENT_ID` | `card-issuer` | Client ID de KafkaJS |
| `SQLITE_PATH` | `./data/card-issuer.sqlite` | Ruta del archivo de base de datos SQLite |

---

## Instalación y ejecución

### Desarrollo local (watch mode)

Requiere un broker Kafka accesible. Para levantarlo de forma aislada, desde la raíz del repo:

```bash
docker compose up kafka
```

Luego, en este directorio:

```bash
cp .env.example .env   # ajustar KAFKA_BROKERS si es necesario
npm install
npm run start:dev
```

### Producción local

```bash
npm install
npm run build
npm run start:prod
```

### Docker (stack completo)

Desde la raíz del repo levanta Kafka, `card-issuer` y `card-processor` juntos:

```bash
docker compose up card-issuer
```

---

## Tests

```bash
npm test                    # unitarios
npm run test:cov            # unitarios con coverage
npm run test:e2e            # e2e (no requiere Kafka)
npm run test:integration    # integración
```

---

## Endpoints

### `POST /cards/issue` — solicitar emisión de tarjeta

Valida el payload, crea la solicitud en estado `PENDING` y dispara el flujo asíncrono.

**Request body:**

```json
{
  "customer": {
    "documentType": "DNI",
    "documentNumber": "12345678",
    "fullName": "Ana García",
    "age": 28,
    "email": "ana@example.com"
  },
  "product": {
    "type": "VISA",
    "currency": "PEN"
  },
  "forceError": false
}
```

| Campo | Restricciones |
|---|---|
| `customer.documentType` | Solo `"DNI"` |
| `customer.documentNumber` | 8 dígitos numéricos |
| `customer.age` | Entero ≥ 18 |
| `customer.email` | Email válido |
| `product.type` | Solo `"VISA"` |
| `product.currency` | `"PEN"` o `"USD"` |
| `forceError` | Opcional. `true` fuerza el fallo de la emisión (camino DLQ) |

**Respuesta exitosa — `202 Accepted`:**

```json
{
  "requestId": "07bbca7e-7d1a-4124-9d81-d5a2b00d2063",
  "status": "PENDING"
}
```

| Código | Motivo |
|---|---|
| `202` | Solicitud admitida, emisión en curso |
| `400` | Payload inválido (validación fallida) |
| `409` | El `documentNumber` ya tiene una solicitud registrada |

---

### `GET /cards/:requestId/status` — consultar estado

Devuelve el estado actual del flujo para el `requestId` dado.

**Respuesta exitosa — `200 OK`:**

```json
{
  "requestId": "07bbca7e-7d1a-4124-9d81-d5a2b00d2063",
  "status": "ISSUED",
  "updatedAt": "2026-05-25T06:00:00.000Z"
}
```

| `status` | Significado |
|---|---|
| `PENDING` | El processor aún no respondió |
| `ISSUED` | La tarjeta fue emitida con éxito |
| `FAILED` | El processor agotó los reintentos (ver DLQ) |

| Código | Motivo |
|---|---|
| `200` | Estado encontrado |
| `404` | `requestId` no existe |

---

## Swagger UI

Con el servicio corriendo, abre en el navegador:

| URL | Descripción |
|---|---|
| `http://localhost:3000/docs` | Swagger UI interactivo |
| `http://localhost:3000/docs-json` | Spec OpenAPI en JSON |

---

## Contexto en el sistema

Este servicio es la mitad del flujo. Para la arquitectura completa y el comportamiento de reintentos/DLQ consulta el [README raíz](../README.md).
