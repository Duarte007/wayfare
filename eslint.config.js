import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Clean Architecture boundaries, enforced by lint: inner layers never import outer layers or SDKs.
 * See docs/ARCHITECTURE.md.
 */
const SDKS = [
  '@supabase/*',
  'dexie',
  'dexie-react-hooks',
  '@anthropic-ai/sdk',
  '@anthropic-ai/sdk/*',
  'openai',
  'hono',
  'hono/*',
  'maplibre-gl',
  'maplibre-gl/*',
  'pmtiles',
  '@protomaps/*',
];

const restrict = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.vercel/**', '**/dev-dist/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Domain: pure TypeScript, no frameworks.
  {
    files: ['packages/shared/src/**/*.ts', 'apps/web/src/features/*/domain/**'],
    rules: restrict(
      [
        ...SDKS,
        'react',
        'react-*',
        '**/application/**',
        '**/infrastructure/**',
        '**/ui/**',
        '**/interface/**',
      ],
      'Domain code must stay framework-free and must not depend on outer layers.',
    ),
  },
  // Application: use cases and hooks talk to ports, never to adapters or SDKs.
  {
    files: ['apps/api/src/application/**', 'apps/web/src/features/*/application/**'],
    rules: restrict(
      [
        ...SDKS,
        '**/infrastructure/**',
        '**/interface/**',
        '**/ui/**',
        '**/container*',
        '**/app/**',
      ],
      'Application code depends on ports (interfaces), not on adapters, SDKs or the UI.',
    ),
  },
  // UI: renders and wires events through application hooks.
  {
    files: ['apps/web/src/features/*/ui/**', 'apps/web/src/shared/ui/**'],
    rules: restrict(
      [...SDKS, '**/infrastructure/**'],
      'UI goes through application hooks; it never calls infrastructure or SDKs directly.',
    ),
  },
  // HTTP interface: controllers call use cases; adapters are wired in the composition root.
  {
    files: ['apps/api/src/interface/**'],
    rules: restrict(
      [
        '@anthropic-ai/sdk',
        '@anthropic-ai/sdk/*',
        'openai',
        '**/infrastructure/ai/**',
        '**/container*',
      ],
      'HTTP layer must not construct adapters; inject them from the composition root.',
    ),
  },
);
