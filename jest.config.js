module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@starisian/3iatlas-multilingual-input-core$': '<rootDir>/packages/core/src',
    '^@starisian/3iatlas-multilingual-input-react$': '<rootDir>/packages/react/src',
    '^@starisian/3iatlas-multilingual-input-adapters$': '<rootDir>/packages/adapters/src',
    '^@starisian/3iatlas-multilingual-input-keyman$': '<rootDir>/packages/keyman/src',
    '^@starisian/3iatlas-multilingual-input-profiles$': '<rootDir>/packages/profiles/src'
  }
};
