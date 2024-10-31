module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
      '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
      }],
    }
  };