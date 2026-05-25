import { ApiProperty } from '@nestjs/swagger';
import { CardRequestStatus } from '../entities/card-request.entity';

export class CardStatusResponseDto {
  @ApiProperty({
    example: '07bbca7e-7d1a-4124-9d81-d5a2b00d2063',
    format: 'uuid',
    description: 'Identificador único de la solicitud.',
  })
  requestId!: string;

  @ApiProperty({
    enum: ['PENDING', 'ISSUED', 'FAILED'],
    example: 'ISSUED',
    description:
      'Estado actual del flujo. `PENDING` mientras el processor no responde; ' +
      '`ISSUED` cuando el processor emitió la tarjeta con éxito; ' +
      '`FAILED` cuando el processor agotó los reintentos y publicó en DLQ.',
  })
  status!: CardRequestStatus;

  @ApiProperty({
    example: '2026-05-25T06:00:00.000Z',
    description: 'Fecha y hora de la última actualización del estado.',
  })
  updatedAt!: Date;
}
