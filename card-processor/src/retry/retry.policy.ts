/**
 * Política de reintentos fija definida en el enunciado:
 *   - Intento inicial.
 *   - Reintentos cada 1s, 2s, 4s.
 *   - Máximo 3 reintentos.
 * Esto suma hasta 4 intentos totales (1 original + 3 reintentos).
 */
export const RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000];
export const MAX_RETRIES = RETRY_DELAYS_MS.length;

export interface RetryAttemptInfo {
  attempt: number; // 1-based
  delayMs: number; // delay aplicado antes de este intento (0 para el primero)
}

export function delayForAttempt(attempt: number): number {
  if (attempt <= 1) return 0;
  const idx = attempt - 2;
  // idx < 0 es código defensivo inalcanzable: attempt <= 1 ya retornó arriba.
  /* istanbul ignore next */
  if (idx < 0 || idx >= RETRY_DELAYS_MS.length) return 0;
  return RETRY_DELAYS_MS[idx];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
}

/**
 * Ejecuta `task` hasta `MAX_RETRIES + 1` veces con la cadencia 1s/2s/4s entre reintentos.
 * Devuelve el resultado o la última falla — no lanza, así el caller decide qué hacer.
 */
export async function runWithRetries<T>(
  task: (attempt: number) => Promise<T>,
  onAttemptFailed?: (info: RetryAttemptInfo & { error: Error }) => void,
): Promise<RetryResult<T>> {
  const totalAttempts = MAX_RETRIES + 1;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const delayMs = delayForAttempt(attempt);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    try {
      const value = await task(attempt);
      return { success: true, value, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      onAttemptFailed?.({ attempt, delayMs, error: lastError });
    }
  }
  return { success: false, error: lastError, attempts: totalAttempts };
}
