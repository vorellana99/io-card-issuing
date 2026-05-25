import { randomInt } from 'crypto';

/**
 * Genera datos sintéticos de tarjeta VISA. Sólo para fines de la prueba —
 * los números son aleatorios pero pasan el check Luhn para que se vean realistas.
 */
const VISA_BIN = '411111'; // BIN reservado para pruebas

export interface GeneratedCard {
  cardNumber: string;
  expiry: string; // MM/YY
  cvv: string;
}

export function generateCard(): GeneratedCard {
  const cardNumber = generateLuhnCardNumber(VISA_BIN, 16);
  const expiry = generateExpiry(4);
  const cvv = generateCvv();
  return { cardNumber, expiry, cvv };
}

export function generateLuhnCardNumber(bin: string, length: number): string {
  const bodyLen = length - bin.length - 1; // -1 por el dígito de control
  let body = '';
  for (let i = 0; i < bodyLen; i++) {
    body += randomInt(0, 10).toString();
  }
  const partial = bin + body;
  const checkDigit = luhnCheckDigit(partial);
  return partial + checkDigit;
}

export function luhnCheckDigit(numWithoutCheck: string): string {
  let sum = 0;
  // El dígito de control irá al final, así que doblamos desde la derecha hacia la izquierda.
  for (let i = 0; i < numWithoutCheck.length; i++) {
    const fromRight = numWithoutCheck.length - 1 - i;
    let digit = Number(numWithoutCheck[fromRight]);
    // Como el check digit ocupará la posición par desde la derecha (i=0),
    // los dígitos del partial en posiciones pares (i=0, 2, ...) se doblan.
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidLuhn(num: string): boolean {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    const fromRight = num.length - 1 - i;
    let digit = Number(num[fromRight]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function generateExpiry(yearsFromNow: number): string {
  const now = new Date();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = (now.getUTCFullYear() + yearsFromNow) % 100;
  return `${month}/${year.toString().padStart(2, '0')}`;
}

export function generateCvv(): string {
  return randomInt(0, 1000).toString().padStart(3, '0');
}
