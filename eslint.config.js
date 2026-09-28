import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const HEX = '/#[0-9a-fA-F]{3,8}\\b/';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/api/drizzle/**',
      '**/.ladle/build/**',
      // Vendored Tesseract files copied from node_modules at dev/build time.
      'apps/web/public/ocr/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
    },
  },
  {
    // CLAUDE.md rule 5: design tokens only, no raw hex values in components.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    // Tests may hold spec values (e.g. tokens.test.ts checks tokens.css against SRS 4.1).
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${HEX}]`,
          message:
            'Use a design token (var(--token) or a Tailwind token class), not a raw hex value.',
        },
        {
          selector: `TemplateElement[value.raw=${HEX}]`,
          message:
            'Use a design token (var(--token) or a Tailwind token class), not a raw hex value.',
        },
      ],
    },
  },
);
