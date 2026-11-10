import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/storybook-static/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
    },
  },
);
