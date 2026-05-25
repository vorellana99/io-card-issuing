import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.docs.ts',
    '!src/common/dto/**',
    '!src/cards/dto/card-status-response.dto.ts',
    '!src/cards/dto/issue-card-response.dto.ts',
  ],
  coverageDirectory: './coverage',
  clearMocks: true,
};

export default config;
