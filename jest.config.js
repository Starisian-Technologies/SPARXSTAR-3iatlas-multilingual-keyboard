/** Jest configuration for the workspace test suite. */
export default {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'jsdom',
	testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
	moduleNameMapper: {
		'^@starisian/3iatlas-multilingual-input$':
			'<rootDir>/packages/multilingual-input/src/index.ts',
		'^@starisian/3iatlas-multilingual-input-core$':
			'<rootDir>/packages/core/src/index.ts',
		'^@starisian/3iatlas-multilingual-input-adapters$':
			'<rootDir>/packages/adapters/src/index.ts',
		'^@starisian/3iatlas-multilingual-input-keyman$':
			'<rootDir>/packages/keyman/src/index.ts',
		'^@starisian/3iatlas-multilingual-input-profiles$':
			'<rootDir>/packages/profiles/src/index.ts',
		'^@starisian/3iatlas-multilingual-input-react$':
			'<rootDir>/packages/react/src/index.ts',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{ tsconfig: '<rootDir>/tsconfig.json', useESM: true },
		],
	},
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
