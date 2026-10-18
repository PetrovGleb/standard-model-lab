/* Desktop packaging: builds the web app, bundles the Electron main process and the API with esbuild, stages the Postgres 17 binaries
   and runs electron-builder into release/ for mac-arm64, mac-x64 (.app plus zip) and win-x64 (portable .exe). Usage: pnpm package [target|all]. */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Arch, build as buildApplication, Platform } from 'electron-builder';
import { build as bundle, type Plugin } from 'esbuild';

interface DesktopTarget {
  readonly platform: Platform;
  readonly arch: Arch;
  readonly postgresPackage: string;
  readonly builderTargets: readonly string[];
}

interface PostgresSymlink {
  readonly source: string;
  readonly target: string;
}

const TARGETS: Readonly<Record<string, DesktopTarget>> = {
  'mac-arm64': {
    platform: Platform.MAC,
    arch: Arch.arm64,
    postgresPackage: '@embedded-postgres/darwin-arm64',
    builderTargets: ['dir', 'zip'],
  },
  'mac-x64': {
    platform: Platform.MAC,
    arch: Arch.x64,
    postgresPackage: '@embedded-postgres/darwin-x64',
    builderTargets: ['dir', 'zip'],
  },
  'win-x64': {
    platform: Platform.WINDOWS,
    arch: Arch.x64,
    postgresPackage: '@embedded-postgres/windows-x64',
    builderTargets: ['portable'],
  },
};

const PRODUCT_NAME = 'Standard Model Lab';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DESKTOP = path.join(ROOT, 'apps/desktop');
const STAGING = path.join(ROOT, '.desktop-build');
const RELEASE = path.join(ROOT, 'release');
const BUNDLES = path.join(STAGING, 'bundles');
const NODE_TARGET = 'node24';
const SEQUELIZE_CONNECTION_MANAGER =
  /sequelize[\\/]lib[\\/]dialects[\\/]abstract[\\/]connection-manager\.js$/;
const DYNAMIC_DIALECT_REQUIRE = 'return require(moduleName);';
const OPTIONAL_MODULES = [
  'pg-native',
  'pg-hstore',
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  'class-transformer',
  'class-transformer/storage',
  'class-validator',
];

const desktopRequire = createRequire(path.join(DESKTOP, 'package.json'));

const staticPostgresDriver: Plugin = {
  name: 'static-postgres-driver',
  setup(build) {
    build.onLoad({ filter: SEQUELIZE_CONNECTION_MANAGER }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      if (!source.includes(DYNAMIC_DIALECT_REQUIRE)) {
        throw new Error(
          `Sequelize no longer contains "${DYNAMIC_DIALECT_REQUIRE}" in ${args.path}`,
        );
      }
      return {
        contents: source.replace(
          DYNAMIC_DIALECT_REQUIRE,
          'return moduleName === "pg" ? require("pg") : require(moduleName);',
        ),
        loader: 'js',
      };
    });
  },
};

async function bundleSources(): Promise<void> {
  const shared = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: NODE_TARGET,
    minify: true,
    keepNames: true,
    tsconfig: path.join(ROOT, 'tsconfig.json'),
    logLevel: 'warning',
  } as const;
  await bundle({
    ...shared,
    entryPoints: [path.join(DESKTOP, 'src/main.ts')],
    outfile: path.join(BUNDLES, 'main.cjs'),
    external: ['electron'],
  });
  await bundle({
    ...shared,
    entryPoints: [path.join(DESKTOP, 'src/api-entry.ts')],
    outfile: path.join(BUNDLES, 'api.cjs'),
    external: OPTIONAL_MODULES,
    plugins: [staticPostgresDriver],
  });
}

async function stageApplication(directory: string, version: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await cp(BUNDLES, directory, { recursive: true });
  await cp(path.join(ROOT, 'apps/web/dist'), path.join(directory, 'web'), { recursive: true });
  const manifest = {
    name: 'standard-model-lab',
    productName: PRODUCT_NAME,
    version,
    description: 'Standard Model particle simulations',
    author: 'Standard Model Lab',
    main: 'main.cjs',
  };
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function stagePostgres(packageName: string, directory: string): Promise<void> {
  const native = path.join(
    await realpath(path.join(DESKTOP, 'node_modules', packageName)),
    'native',
  );
  await cp(native, directory, { recursive: true, verbatimSymlinks: true });
  const links = JSON.parse(
    await readFile(path.join(native, 'pg-symlinks.json'), 'utf8'),
  ) as readonly PostgresSymlink[];
  const insideNative = (entry: string): string =>
    path.join(directory, path.relative('native', entry));
  await Promise.all(
    links.map(async (link) => {
      const target = insideNative(link.target);
      await rm(target, { force: true });
      await symlink(path.relative(path.dirname(target), insideNative(link.source)), target);
    }),
  );
  await rm(path.join(directory, 'pg-symlinks.json'));
}

async function packageTarget(name: string, target: DesktopTarget, version: string): Promise<void> {
  const workspace = path.join(STAGING, name);
  const applicationDirectory = path.join(workspace, 'app');
  const postgresDirectory = path.join(workspace, 'postgres');
  await rm(workspace, { recursive: true, force: true });
  await stageApplication(applicationDirectory, version);
  await stagePostgres(target.postgresPackage, postgresDirectory);
  const electronVersion = (desktopRequire('electron/package.json') as { version: string }).version;
  await buildApplication({
    targets: target.platform.createTarget([...target.builderTargets], target.arch),
    config: {
      appId: 'lab.standardmodel.desktop',
      productName: PRODUCT_NAME,
      electronVersion,
      npmRebuild: false,
      asar: true,
      directories: { app: applicationDirectory, output: path.join(RELEASE, name) },
      extraResources: [{ from: postgresDirectory, to: 'postgres' }],
      icon: path.join(ROOT, 'apps/web/public/icon-512.png'),
      electronLanguages: ['ru', 'en'],
      mac: { identity: '-', hardenedRuntime: false, category: 'public.app-category.education' },
      portable: { artifactName: `${PRODUCT_NAME} ${version}.exe` },
    },
  });
}

async function main(): Promise<void> {
  const requested = process.argv[2] ?? 'all';
  const names = requested === 'all' ? Object.keys(TARGETS) : [requested];
  const unknown = names.filter((name) => TARGETS[name] === undefined);
  if (unknown.length > 0) {
    throw new Error(
      `Unknown target ${unknown.join(', ')}; use ${Object.keys(TARGETS).join(', ')} or all`,
    );
  }
  const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  execFileSync('pnpm', ['build:web'], { cwd: ROOT, stdio: 'inherit' });
  await rm(BUNDLES, { recursive: true, force: true });
  await bundleSources();
  for (const name of names) {
    const target = TARGETS[name];
    if (target !== undefined) {
      await packageTarget(name, target, version);
    }
  }
  console.log(`Ready in ${RELEASE}`);
}

main().catch((failure: unknown) => {
  console.error(failure);
  process.exit(1);
});
