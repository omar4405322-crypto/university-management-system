import type { Config } from 'jest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreDiagnostics: [151001],
      },
    }],
  },
  globalSetup: './src/__tests__/setup/globalSetup.ts',
  globalTeardown: './src/__tests__/setup/globalTeardown.ts',
  setupFiles: ['./src/__tests__/setup/redisMock.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 75,
      branches: 70,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/types/**',
    '!src/docs/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!src/__tests__/setup/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/server.ts',
    'src/utils/socket.ts',
    'src/utils/swagger.ts',
    'src/middleware/audit.middleware.ts',
    'src/controllers/upload.controller.ts',
  ],
};

export default config;
