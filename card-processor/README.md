# card-processor

Consumer Kafka construido con NestJS que procesa los eventos de solicitud de emisión de tarjeta. Escucha el tópico `io.card.requested.v1`, simula la interacción con un proveedor externo e implementa una política de reintentos con backoff. En caso de éxito publica `io.cards.issued.v1`; si se agotan los reintentos, publica el evento fallido en la DLQ `io.card.requested.v1.dlq`.

**Stack:** NestJS · KafkaJS · TypeORM · SQLite · Pino

---

## Variables de entorno

Copia `.env.example` como punto de partida:

```bash
cp .env.example .env
```

| Variable | Default | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | Entorno de ejecución |
| `LOG_LEVEL` | `debug` | Nivel de log (`debug`, `info`, `warn`, `error`) |
| `LOG_PRETTY` | `true` | Logs formateados en consola (`false` en producción) |
| `KAFKA_BROKERS` | `localhost:9094` | Bootstrap servers de Kafka (separados por coma) |
| `KAFKA_CLIENT_ID` | `card-processor` | Client ID de KafkaJS |
| `KAFKA_GROUP_ID` | `card-processor-group` | Consumer group ID |
| `SQLITE_PATH` | `./data/card-processor.sqlite` | Ruta del archivo de base de datos SQLite |
| `SIMULATED_LATENCY_MIN_MS` | `200` | Latencia mínima simulada del proveedor externo (ms) |
| `SIMULATED_LATENCY_MAX_MS` | `500` | Latencia máxima simulada del proveedor externo (ms) |
| `SUCCESS_PROBABILITY` | `0.6` | Probabilidad de éxito por intento (`0..1`) |

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
docker compose up card-processor
```

---

## Tests

```bash
npm test            # unitarios + componente
npm run test:cov    # con coverage
```

---

## Comportamiento del consumer

### Flujo de procesamiento

Cuando llega un mensaje al tópico `io.card.requested.v1`:

1. **Idempotencia:** verifica si ya existe una tarjeta con ese `requestId` en la base de datos. Si existe, descarta el evento silenciosamente (log `warn`).
2. **Simulación del proveedor externo:** introduce una latencia aleatoria entre `SIMULATED_LATENCY_MIN_MS` y `SIMULATED_LATENCY_MAX_MS`, luego decide éxito o fallo con probabilidad `SUCCESS_PROBABILITY`.
3. **`forceError: true`:** fuerza el fallo en todos los intentos, útil para ejercitar el camino DLQ de forma determinística.

### Política de reintentos (backoff fijo)

| Intento | Espera antes del reintento |
|---|---|
| 1er reintento | 1 segundo |
| 2do reintento | 2 segundos |
| 3er reintento | 4 segundos |
| Tras 3 fallos | Publica en DLQ |

Total: 4 intentos (1 inicial + 3 reintentos).

### En caso de éxito

- Persiste la tarjeta emitida en SQLite (`cards`): `cardId`, `cardNumber`, `expiry`, `cvv`, `cardholder`, etc.
- Publica evento `io.cards.issued.v1` para que `card-issuer` actualice el estado a `ISSUED`.

### En caso de fallo total (DLQ)

- Publica en `io.card.requested.v1.dlq` con:

```json
{
  "error": {
    "reason": "...",
    "attempts": 3,
    "timestamp": "2026-05-25T11:13:04.000Z"
  },
  "originalPayload": { }
}
```

---

## Contexto en el sistema

Este servicio es la mitad del flujo. Para la arquitectura completa consulta el [README raíz](../README.md).
