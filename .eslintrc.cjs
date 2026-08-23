module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json']
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2020: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error'
  },
  ignorePatterns: ['dist/', 'assets/', 'node_modules/']
};
