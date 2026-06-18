
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/tests/**/*.test.{ts,js}'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreDiagnostics: [151001],
      },
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
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


