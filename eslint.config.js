// Flat config. ESLint 9+ no longer reads .eslintrc files.
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
	},
	js.configs.recommended,
	{
		// Node-side tooling scripts, not shipped in any package.
		files: ['scripts/**/*.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				URL: 'readonly',
				console: 'readonly',
				process: 'readonly',
			},
		},
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
				ecmaFeatures: { jsx: true },
			},
			globals: {
				globalThis: 'readonly',
				Intl: 'readonly',
				Event: 'readonly',
				HTMLDivElement: 'readonly',
				console: 'readonly',
			},
		},
		plugins: { '@typescript-eslint': tseslint },
		rules: {
			...tseslint.configs.recommended.rules,
			// Specification section 10 and the repository standard: never `any`.
			'@typescript-eslint/no-explicit-any': 'error',
			// Named exports only, so the public surface is greppable.
			'no-restricted-syntax': [
				'error',
				{
					selector: 'ExportDefaultDeclaration',
					message: 'Use named exports only.',
				},
			],
			'no-var': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_' },
			],
			'no-undef': 'off',
		},
	},
];
