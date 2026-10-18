/* Electron main process: opens the web app over app:// at once (its splash plays while Postgres and the API start in a utility process),
   holds /api requests until the API answers, and stops both on quit. */
import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  net,
  protocol,
  shell,
  utilityProcess,
} from 'electron';
import type { UtilityProcess } from 'electron';
import { createWriteStream, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DATABASE_NAME,
  DATABASE_USER,
  freePort,
  LOCAL_HOST,
  startDatabase,
} from './database-server.js';
import type { DatabaseServer } from './database-server.js';

const APP_SCHEME = 'app';
const APP_ORIGIN = 'app://lab';
const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;
const MINIMUM_WINDOW_WIDTH = 960;
const MINIMUM_WINDOW_HEIGHT = 640;
const HEALTH_POLL_MILLISECONDS = 250;
const HEALTH_TIMEOUT_MILLISECONDS = 90_000;
const NOT_FOUND = 404;
const SERVICE_UNAVAILABLE = 503;
const LIGHT_BACKGROUND = 'rgb(247, 245, 237)';
const DARK_BACKGROUND = 'rgb(29, 24, 19)';
const WEB_LINK = /^https?:\/\//;

let database: DatabaseServer | null = null;
let api: UtilityProcess | null = null;
let apiExitCode: number | null = null;
let stopped = false;

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForApi(port: number): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (apiExitCode !== null) {
      throw new Error(`API stopped with code ${String(apiExitCode)}, see api.log`);
    }
    const healthy = await net
      .fetch(`http://${LOCAL_HOST}:${String(port)}/api/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (healthy) {
      return;
    }
    await delay(HEALTH_POLL_MILLISECONDS);
  }
  throw new Error('API did not answer in time, see api.log');
}

function startApi(server: DatabaseServer, port: number): UtilityProcess {
  const child = utilityProcess.fork(path.join(app.getAppPath(), 'api.cjs'), [], {
    serviceName: 'Standard Model API',
    stdio: 'pipe',
    env: {
      ...process.env,
      POSTGRES_HOST: LOCAL_HOST,
      POSTGRES_PORT: String(server.port),
      POSTGRES_DB: DATABASE_NAME,
      POSTGRES_USER: DATABASE_USER,
      POSTGRES_PASSWORD: server.password,
      API_PORT: String(port),
    },
  });
  const log = createWriteStream(path.join(app.getPath('userData'), 'api.log'));
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  child.once('exit', (code) => {
    apiExitCode = code;
  });
  return child;
}

function isFile(candidate: string): boolean {
  return statSync(candidate, { throwIfNoEntry: false })?.isFile() === true;
}

function serveWeb(webRoot: string, apiPort: Promise<number>): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const port = await apiPort.catch(() => null);
      if (port === null) {
        return new Response(null, { status: SERVICE_UNAVAILABLE });
      }
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
      return net.fetch(`http://${LOCAL_HOST}:${String(port)}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
      });
    }
    const requested = path.join(webRoot, decodeURIComponent(url.pathname));
    if (!requested.startsWith(webRoot + path.sep)) {
      return new Response(null, { status: NOT_FOUND });
    }
    const file = isFile(requested) ? requested : path.join(webRoot, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MINIMUM_WINDOW_WIDTH,
    minHeight: MINIMUM_WINDOW_HEIGHT,
    title: 'Standard Model Lab',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (WEB_LINK.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      if (WEB_LINK.test(url)) {
        void shell.openExternal(url);
      }
    }
  });
  return window;
}

async function startBackend(): Promise<number> {
  const userData = app.getPath('userData');
  database = await startDatabase({
    binaryDirectory: path.join(process.resourcesPath, 'postgres', 'bin'),
    dataDirectory: path.join(userData, 'postgres-17'),
    stateDirectory: userData,
  });
  const port = await freePort();
  api = startApi(database, port);
  await waitForApi(port);
  return port;
}

async function launch(): Promise<void> {
  const apiPort = startBackend();
  serveWeb(path.join(app.getAppPath(), 'web'), apiPort);
  const window = createWindow();
  await Promise.all([window.loadURL(`${APP_ORIGIN}/index.html`), apiPort]);
}

async function shutdown(): Promise<void> {
  api?.kill();
  await database?.stop();
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    window?.show();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!stopped) {
      event.preventDefault();
      void shutdown().finally(() => {
        stopped = true;
        app.quit();
      });
    }
  });
  app
    .whenReady()
    .then(launch)
    .catch((failure: unknown) => {
      dialog.showErrorBox('Standard Model Lab не запустился', String(failure));
      app.quit();
    });
} else {
  app.quit();
}
