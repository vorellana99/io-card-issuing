import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape estándar de los errores HTTP que emite NestJS desde sus excepciones
 * built-in (`BadRequestException`, `ConflictException`, etc.).
 * Vive en `common/` porque aplica a cualquier endpoint, no a uno en particular.
 */
export class HttpErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    description:
      'Detalle del error. Para errores de validación (400) es un array con los mensajes; para conflictos (409) es un string.',
    oneOf: [
      { type: 'string', example: 'El cliente ya tiene una solicitud de tarjeta registrada' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['documentNumber debe tener 8 dígitos (DNI)', 'age debe ser >= 18'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
