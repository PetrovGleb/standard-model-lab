/* Vitest configuration: runs every *.test.ts inside libs, packages and apps, with .env loaded for database-backed tests. */
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const environmentFile = '.env';
const environment = existsSync(environmentFile)
  ? parseEnv(readFileSync(environmentFile, 'utf8'))
  : {};

export default defineConfig({
  test: {
    include: ['libs/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    env: environment,
  },
});
