import {
  delayForAttempt,
  MAX_RETRIES,
  RETRY_DELAYS_MS,
  runWithRetries,
} from '../src/retry/retry.policy';

describe('retry.policy', () => {
  it('los delays son [1000, 2000, 4000] y MAX_RETRIES=3', () => {
    expect([...RETRY_DELAYS_MS]).toEqual([1000, 2000, 4000]);
    expect(MAX_RETRIES).toBe(3);
  });

  it('delayForAttempt mapea 1→0, 2→1000, 3→2000, 4→4000', () => {
    expect(delayForAttempt(1)).toBe(0);
    expect(delayForAttempt(2)).toBe(1000);
    expect(delayForAttempt(3)).toBe(2000);
    expect(delayForAttempt(4)).toBe(4000);
  });

  it('delayForAttempt retorna 0 cuando attempt supera el máximo de reintentos', () => {
    expect(delayForAttempt(5)).toBe(0);
    expect(delayForAttempt(100)).toBe(0);
  });

  it('retorna éxito si el primer intento es ok (sin reintentos)', async () => {
    const task = jest.fn(async () => 'ok');
    const result = await runWithRetries(task);
    expect(result.success).toBe(true);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('reintenta hasta 4 veces (1 + 3 retries) y reporta cada falla', async () => {
    jest.useFakeTimers();
    try {
      const task = jest.fn(async () => {
        throw new Error('boom');
      });
      const onFail = jest.fn();
      const promise = runWithRetries(task, onFail);
      // Avanzamos todos los timers; con jest.useFakeTimers los setTimeout dentro
      // del runWithRetries se disparan al ejecutar advanceTimersByTimeAsync.
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 10);
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(MAX_RETRIES + 1);
      expect(task).toHaveBeenCalledTimes(MAX_RETRIES + 1);
      // 4 intentos fallaron → 4 callbacks
      expect(onFail).toHaveBeenCalledTimes(MAX_RETRIES + 1);
      // El primer callback es attempt=1 con delayMs=0
      expect(onFail.mock.calls[0][0].attempt).toBe(1);
      expect(onFail.mock.calls[0][0].delayMs).toBe(0);
      expect(onFail.mock.calls[1][0].delayMs).toBe(1000);
      expect(onFail.mock.calls[2][0].delayMs).toBe(2000);
      expect(onFail.mock.calls[3][0].delayMs).toBe(4000);
    } finally {
      jest.useRealTimers();
    }
  });

  it('envuelve en Error cuando el task lanza un valor no-Error', async () => {
    jest.useFakeTimers();
    try {
      const task = jest.fn(async () => {
        throw 'string error';
      });
      const onFail = jest.fn();
      const promise = runWithRetries(task, onFail);
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 10);
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('string error');
    } finally {
      jest.useRealTimers();
    }
  });

  it('retorna éxito si un reintento intermedio funciona', async () => {
    jest.useFakeTimers();
    try {
      let calls = 0;
      const task = jest.fn(async () => {
        calls++;
        if (calls < 3) throw new Error('aún no');
        return 'ok';
      });
      const promise = runWithRetries(task);
      await jest.advanceTimersByTimeAsync(1000 + 2000 + 10);
      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.value).toBe('ok');
      expect(result.attempts).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
