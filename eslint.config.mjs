import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  ...compat.config({
    plugins: ['@typescript-eslint'],
    overrides: [
      {
        files: ['src/server/**/*.ts', 'src/db/**/*.ts', 'src/app/api/**/*.ts', 'src/lib/**/*.ts'],
        parserOptions: {
          project: './tsconfig.json',
        },
        rules: {
          '@typescript-eslint/no-floating-promises': 'error',
          '@typescript-eslint/no-misused-promises': [
            'error',
            {
              checksVoidReturn: false,
            },
          ],
        },
      },
    ],
  }),
  {
    ignores: ['.next/', 'node_modules/', 'playwright-report/', 'dist/'],
  },
];

export default eslintConfig;
