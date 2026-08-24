/** Jest configuration for strict TypeScript unit tests. */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	testMatch: [ '**/tests/**/*.test.ts' ],
};
