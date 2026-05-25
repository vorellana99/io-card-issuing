import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.integration-spec.ts'],
  // Timeout elevado: el flujo asíncrono puede tardar hasta ~7s (4 intentos con backoff)
  // más latencia de red y tiempo de procesamiento del stack dockerizado.
  testTimeout: 30000,
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
};

export default config;
