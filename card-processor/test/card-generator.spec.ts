import {
  generateCard,
  generateCvv,
  generateExpiry,
  isValidLuhn,
  luhnCheckDigit,
} from '../src/cards/card-generator';

describe('card-generator', () => {
  it('generateCard produce un número VISA de 16 dígitos válido por Luhn', () => {
    for (let i = 0; i < 50; i++) {
      const { cardNumber, expiry, cvv } = generateCard();
      expect(cardNumber).toMatch(/^4\d{15}$/);
      expect(isValidLuhn(cardNumber)).toBe(true);
      expect(expiry).toMatch(/^\d{2}\/\d{2}$/);
      expect(cvv).toMatch(/^\d{3}$/);
    }
  });

  it('luhnCheckDigit coincide con una validación independiente', () => {
    const partial = '411111111111111';
    const check = luhnCheckDigit(partial);
    expect(isValidLuhn(partial + check)).toBe(true);
  });

  it('generateExpiry adelanta los años solicitados', () => {
    const expiry = generateExpiry(4);
    const [, yy] = expiry.split('/');
    const currentYY = new Date().getUTCFullYear() % 100;
    expect(Number(yy)).toBe((currentYY + 4) % 100);
  });

  it('generateCvv produce siempre 3 dígitos', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateCvv()).toMatch(/^\d{3}$/);
    }
  });
});
