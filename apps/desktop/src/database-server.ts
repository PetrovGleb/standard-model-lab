/* Embedded Postgres for the desktop app: creates a cluster in the user data folder on first run, starts it on a free local port with pg_ctl and stops it on quit. */
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

export const DATABASE_USER = 'standard_model';
export const DATABASE_NAME = 'postgres';
export const LOCAL_HOST = '127.0.0.1';

const PASSWORD_BYTES = 24;
const START_TIMEOUT_SECONDS = 60;
const LOG_TAIL_CHARACTERS = 2000;

const runToCompletion = promisify(execFile);

export interface DatabaseLocation {
  readonly binaryDirectory: string;
  readonly dataDirectory: string;
  readonly stateDirectory: string;
}

export interface DatabaseServer {
  readonly port: number;
  readonly password: string;
  stop(): Promise<void>;
}

function binary(directory: string, name: string): string {
  return path.join(directory, process.platform === 'win32' ? `${name}.exe` : name);
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOCAL_HOST, () => {
      const address = server.address();
      server.close(() => {
        if (address !== null && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('No free local port'));
        }
      });
    });
  });
}

function control(location: DatabaseLocation, args: readonly string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary(location.binaryDirectory, 'pg_ctl'), args, {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function logTail(logFile: string): Promise<string> {
  const log = await readFile(logFile, 'utf8').catch(() => '');
  return log.slice(-LOG_TAIL_CHARACTERS);
}

async function initialise(location: DatabaseLocation, passwordFile: string): Promise<string> {
  const password = randomBytes(PASSWORD_BYTES).toString('hex');
  const transientPasswordFile = path.join(location.stateDirectory, 'initdb-password');
  await rm(location.dataDirectory, { recursive: true, force: true });
  await writeFile(transientPasswordFile, password);
  try {
    await runToCompletion(
      binary(location.binaryDirectory, 'initdb'),
      [
        '-D',
        location.dataDirectory,
        '-U',
        DATABASE_USER,
        `--pwfile=${transientPasswordFile}`,
        '--auth=scram-sha-256',
        '-E',
        'UTF8',
        '--no-locale',
      ],
      { windowsHide: true },
    );
  } finally {
    await rm(transientPasswordFile, { force: true });
  }
  await appendFile(
    path.join(location.dataDirectory, 'postgresql.conf'),
    `\nlisten_addresses = '${LOCAL_HOST}'\nunix_socket_directories = ''\n`,
  );
  await writeFile(passwordFile, password);
  return password;
}

async function storedPassword(location: DatabaseLocation, passwordFile: string): Promise<string> {
  const initialised = existsSync(path.join(location.dataDirectory, 'PG_VERSION'));
  if (!initialised) {
    return initialise(location, passwordFile);
  }
  if (!existsSync(passwordFile)) {
    throw new Error(`The database in ${location.dataDirectory} has no stored password`);
  }
  return (await readFile(passwordFile, 'utf8')).trim();
}

export async function startDatabase(location: DatabaseLocation): Promise<DatabaseServer> {
  await mkdir(location.stateDirectory, { recursive: true });
  const passwordFile = path.join(location.stateDirectory, 'database-password');
  const logFile = path.join(location.stateDirectory, 'postgres.log');
  const password = await storedPassword(location, passwordFile);
  const alreadyRunning = (await control(location, ['status', '-D', location.dataDirectory])) === 0;
  if (alreadyRunning) {
    await control(location, ['stop', '-D', location.dataDirectory, '-m', 'fast', '-w']);
  }
  const port = await freePort();
  const started = await control(location, [
    'start',
    '-D',
    location.dataDirectory,
    '-w',
    '-t',
    String(START_TIMEOUT_SECONDS),
    '-l',
    logFile,
    '-o',
    `-p ${String(port)}`,
  ]);
  if (started !== 0) {
    throw new Error(`Postgres did not start:\n${await logTail(logFile)}`);
  }
  return {
    port,
    password,
    stop: async () => {
      await control(location, ['stop', '-D', location.dataDirectory, '-m', 'fast', '-w']);
    },
  };
}
