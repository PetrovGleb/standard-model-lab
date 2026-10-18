/* ESLint flat config: TypeScript rules plus the project naming and header-comment conventions. */
import eslintJavascript from '@eslint/js';
import tseslint from 'typescript-eslint';
import headerOnlyComments from './eslint-rules/header-only-comments.js';

const GREEK_AND_SYMBOL_IDENTIFIERS = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'eps',
  'zeta',
  'eta',
  'theta',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'rho',
  'sigma',
  'phi',
  'chi',
  'psi',
  'omega',
  'hbar',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'release/**',
      '.desktop-build/**',
      'pnpm-lock.yaml',
    ],
  },
  eslintJavascript.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { 'header-only-comments': headerOnlyComments } } },
    rules: {
      'local/header-only-comments': 'error',
      'id-denylist': ['error', ...GREEK_AND_SYMBOL_IDENTIFIERS],
      'id-length': ['error', { min: 3, exceptions: ['id', 'x', 'y', 'z'], properties: 'never' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'forbid' },
        { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'objectLiteralProperty', format: null },
      ],
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'forbid' },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: null },
      ],
    },
  },
  {
    files: ['eslint-rules/**/*.js', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
