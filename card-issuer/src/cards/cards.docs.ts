import { applyDecorators } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../common/dto/http-error.dto';
import { IssueCardRequestDto } from './dto/issue-card-request.dto';
import { IssueCardResponseDto } from './dto/issue-card-response.dto';

/**
 * Toda la documentación Swagger de los endpoints del módulo `cards` vive acá.
 * Mantiene `cards.controller.ts` enfocado en routing y delegación al service,
 * sin contaminarlo con metadata de OpenAPI ni ejemplos de payload.
 *
 * Cada handler del controller aplica el decorador `<verbo><Recurso>Docs()`
 * correspondiente — por ejemplo `@IssueCardDocs()` sobre `issue()`.
 */

const ISSUE_CARD_EXAMPLES = {
  happyPath: {
    summary: 'Caso feliz',
    description:
      'Payload válido. El issuer responde `202 Accepted` y el processor emite la tarjeta asíncronamente.',
    value: {
      customer: {
        documentType: 'DNI',
        documentNumber: '11564321',
        fullName: 'Jose Pérez',
        age: 25,
        email: 'joseperez@example.com',
      },
      product: { type: 'VISA', currency: 'PEN' },
      forceError: false,
    },
  },
  forceErrorDlq: {
    summary: 'Forzar camino DLQ',
    description:
      'Con `forceError: true` el processor agotará los 3 reintentos y publicará en `io.card.requested.v1.dlq`.',
    value: {
      customer: {
        documentType: 'DNI',
        documentNumber: '22222222',
        fullName: 'Test DLQ',
        age: 30,
        email: 'dlq@example.com',
      },
      product: { type: 'VISA', currency: 'USD' },
      forceError: true,
    },
  },
} as const;

const ISSUE_CARD_OPERATION = {
  summary: 'Solicita la emisión de una tarjeta',
  description:
    'Valida el payload, genera un `requestId`, persiste la solicitud en estado `PENDING` y publica un evento ' +
    '`io.card.requested.v1` en Kafka. El `card-processor` procesa la emisión de forma asíncrona y publica el ' +
    'resultado en `io.cards.issued.v1` (éxito) o `io.card.requested.v1.dlq` (fallo tras 3 reintentos).',
} as const;

const RESPONSE_202 = {
  description:
    'Solicitud admitida. El evento ya fue publicado en Kafka y será procesado asíncronamente.',
  type: IssueCardResponseDto,
};

const RESPONSE_400 = {
  description:
    'Payload inválido (DNI mal formado, edad fuera de rango, currency no permitida, etc.).',
  type: HttpErrorResponseDto,
};

const RESPONSE_409 = {
  description:
    'El `documentNumber` ya tiene una solicitud previa. Regla del spec: un cliente, una sola tarjeta.',
  type: HttpErrorResponseDto,
};

export function IssueCardDocs() {
  return applyDecorators(
    ApiOperation(ISSUE_CARD_OPERATION),
    ApiBody({ type: IssueCardRequestDto, examples: ISSUE_CARD_EXAMPLES }),
    ApiAcceptedResponse(RESPONSE_202),
    ApiBadRequestResponse(RESPONSE_400),
    ApiConflictResponse(RESPONSE_409),
  );
}
