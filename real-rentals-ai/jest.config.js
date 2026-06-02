module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  // Los archivos en __tests__/helpers son utilidades de soporte, no suites de tests.
  // Patrón compatible con separadores de Windows (\) y Unix (/).
  testPathIgnorePatterns: ['[\\\\/]node_modules[\\\\/]', '[\\\\/]__tests__[\\\\/]helpers[\\\\/]'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^mrz$': '<rootDir>/src/__tests__/helpers/mrzMock.js',
  },
  testTimeout: 120000,
};

