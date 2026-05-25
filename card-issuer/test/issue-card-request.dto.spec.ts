import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IssueCardRequestDto } from '../src/cards/dto/issue-card-request.dto';

function validDto(): unknown {
  return {
    customer: {
      documentType: 'DNI',
      documentNumber: '11564321',
      fullName: 'Jose Pérez',
      age: 25,
      email: 'joseperez@example.com',
    },
    product: { type: 'VISA', currency: 'PEN' },
    forceError: false,
  };
}

async function errorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(IssueCardRequestDto, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((e) => collectMessages(e));
}

function collectMessages(err: any): string[] {
  const own = err.constraints ? Object.values<string>(err.constraints) : [];
  const nested = (err.children ?? []).flatMap(collectMessages);
  return [...own, ...nested];
}

describe('IssueCardRequestDto', () => {
  it('acepta un payload válido', async () => {
    const errors = await errorsFor(validDto());
    expect(errors).toEqual([]);
  });

  it('rechaza documentType distinto de DNI', async () => {
    const payload = validDto() as any;
    payload.customer.documentType = 'CE';
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/DNI/);
  });

  it('rechaza documentNumber con menos de 8 dígitos', async () => {
    const payload = validDto() as any;
    payload.customer.documentNumber = '1234567';
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/8 dígitos/);
  });

  it('rechaza edad menor a 18', async () => {
    const payload = validDto() as any;
    payload.customer.age = 17;
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/>= 18/);
  });

  it('rechaza email inválido', async () => {
    const payload = validDto() as any;
    payload.customer.email = 'no-es-email';
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/email/i);
  });

  it('rechaza currency distinta de PEN/USD', async () => {
    const payload = validDto() as any;
    payload.product.currency = 'EUR';
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/PEN o USD/);
  });

  it('rechaza product.type distinto de VISA', async () => {
    const payload = validDto() as any;
    payload.product.type = 'MASTERCARD';
    const errors = await errorsFor(payload);
    expect(errors.join(' ')).toMatch(/VISA/);
  });
});
