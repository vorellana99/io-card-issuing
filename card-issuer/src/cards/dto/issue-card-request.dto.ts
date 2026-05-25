import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CustomerDto {
  @ApiProperty({
    enum: ['DNI'],
    example: 'DNI',
    description: 'Tipo de documento. Sólo se admite DNI.',
  })
  @IsIn(['DNI'], { message: 'documentType debe ser DNI' })
  documentType!: 'DNI';

  @ApiProperty({
    example: '11564321',
    description: 'Número de DNI peruano (8 dígitos numéricos).',
    pattern: '^\\d{8}$',
    minLength: 8,
    maxLength: 8,
  })
  @IsString()
  @Matches(/^\d{8}$/, { message: 'documentNumber debe tener 8 dígitos (DNI)' })
  documentNumber!: string;

  @ApiProperty({
    example: 'Jose Pérez',
    description: 'Nombre completo del titular.',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({
    example: 25,
    description: 'Edad del titular. Debe ser mayor o igual a 18.',
    minimum: 18,
    maximum: 120,
  })
  @IsInt()
  @Min(18, { message: 'age debe ser >= 18' })
  @Max(120)
  age!: number;

  @ApiProperty({
    example: 'joseperez@example.com',
    description: 'Correo electrónico del titular.',
    format: 'email',
  })
  @IsEmail({}, { message: 'email inválido' })
  email!: string;
}

export class ProductDto {
  @ApiProperty({
    enum: ['VISA'],
    example: 'VISA',
    description: 'Marca de la tarjeta. Sólo se admite VISA.',
  })
  @IsIn(['VISA'], { message: 'product.type sólo admite VISA' })
  type!: 'VISA';

  @ApiProperty({
    enum: ['PEN', 'USD'],
    example: 'PEN',
    description: 'Moneda de la tarjeta. PEN (soles) o USD (dólares).',
  })
  @IsIn(['PEN', 'USD'], { message: 'product.currency debe ser PEN o USD' })
  currency!: 'PEN' | 'USD';
}

export class IssueCardRequestDto {
  @ApiProperty({ type: CustomerDto, description: 'Datos del cliente solicitante.' })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: ProductDto, description: 'Producto solicitado.' })
  @ValidateNested()
  @Type(() => ProductDto)
  product!: ProductDto;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Si es `true`, fuerza el fallo de la emisión en cada intento para ejercitar el camino DLQ de forma determinística. Útil para pruebas; en producción no debería estar expuesto.',
  })
  @IsOptional()
  @IsBoolean()
  forceError?: boolean;
}
