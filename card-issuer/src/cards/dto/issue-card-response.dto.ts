import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrato de respuesta del endpoint `POST /cards/issue`.
 * Es el return type del `CardsService.issue` y del controller, y también
 * el schema que consume Swagger para documentar la respuesta 202.
 */
export class IssueCardResponseDto {
  @ApiProperty({
    example: '07bbca7e-7d1a-4124-9d81-d5a2b00d2063',
    format: 'uuid',
    description:
      'Identificador único de la solicitud. Se usa como `source` en todos los eventos del flujo.',
  })
  requestId!: string;

  @ApiProperty({
    enum: ['PENDING'],
    example: 'PENDING',
    description:
      'Estado inicial al admitir la solicitud. El processor publica `io.cards.issued.v1` o DLQ asíncronamente.',
  })
  status!: 'PENDING';
}
