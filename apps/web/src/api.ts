/* Typed fetch helpers for the API; every call goes through /api and surfaces server error messages; a run can stream its progress as JSON lines that end with the result. */
import type {
  NuclideEntry,
  ApiErrorResponse,
  CatalogResponse,
  CouplingScheme,
  LagrangianResponse,
  ProcessRequest,
  ProcessResult,
  RunDetail,
  RunEstimate,
  RunListResponse,
  RunProgress,
  RunStreamMessage,
  StartRunRequest,
  TemplateDetail,
  TemplateListResponse,
  ValidatePlanResponse,
} from '@standard-model/contracts';
import { activeLanguage, localize, say } from './language';

const API_PREFIX = '/api';

let catalogRequest: Promise<CatalogResponse> | null = null;

function parseBody(text: string, status: number): unknown {
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      say(
        `Сервер ответил не JSON (HTTP ${String(status)}): ${text.slice(0, 200)}`,
        `The server did not answer with JSON (HTTP ${String(status)}): ${text.slice(0, 200)}`,
      ),
    );
  }
}

function errorText(error: ApiErrorResponse | null, fallback: string): string {
  return error === null
    ? fallback
    : error.text === undefined
      ? [error.message].flat().join('; ')
      : localize(error.text);
}

function noConnection(): Error {
  return new Error(
    say(
      'Нет связи с API: проверьте, что сервер запущен',
      'No connection to the API: check that the server is running',
    ),
  );
}

async function streamRun(
  body: StartRunRequest,
  onProgress: (progress: RunProgress) => void,
  onStarted?: (runId: string) => void,
): Promise<RunDetail> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}/runs/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, language: activeLanguage() }),
    });
  } catch {
    throw noConnection();
  }
  if (!response.ok || response.body === null) {
    const error = parseBody(await response.text(), response.status) as ApiErrorResponse | null;
    throw new Error(errorText(error, response.statusText));
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    buffer += value ?? '';
    const lines = buffer.split('\n');
    buffer = done ? '' : (lines.pop() ?? '');
    for (const line of lines.filter((candidate) => candidate.trim() !== '')) {
      const message = JSON.parse(line) as RunStreamMessage;
      if (message.kind === 'started') {
        onStarted?.(message.runId);
      } else if (message.kind === 'progress') {
        onProgress(message.progress);
      } else if (message.kind === 'done') {
        return message.detail;
      } else {
        throw new Error(errorText(message.error, String(message.error.statusCode)));
      }
    }
    if (done) {
      throw noConnection();
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw noConnection();
  }
  const body = parseBody(await response.text(), response.status);
  if (!response.ok) {
    throw new Error(errorText(body as ApiErrorResponse | null, response.statusText));
  }
  return body as T;
}

const nuclideRequests = new Map<number, Promise<readonly NuclideEntry[]>>();

export const api = {
  catalog: (): Promise<CatalogResponse> => {
    catalogRequest ??= request<CatalogResponse>('/catalog').catch((failure: unknown) => {
      catalogRequest = null;
      throw failure;
    });
    return catalogRequest;
  },
  nuclides: (protons: number): Promise<readonly NuclideEntry[]> => {
    const cached = nuclideRequests.get(protons);
    if (cached !== undefined) {
      return cached;
    }
    const pending = request<readonly NuclideEntry[]>(`/catalog/nuclides/${String(protons)}`);
    nuclideRequests.set(protons, pending);
    pending.catch(() => nuclideRequests.delete(protons));
    return pending;
  },
  templates: () => request<TemplateListResponse>(`/templates?lang=${activeLanguage()}`),
  template: (name: string) =>
    request<TemplateDetail>(`/templates/${encodeURIComponent(name)}?lang=${activeLanguage()}`),
  saveTemplate: (plan: unknown) =>
    request<TemplateDetail>('/templates', { method: 'POST', body: JSON.stringify({ plan }) }),
  deleteTemplate: (name: string) =>
    request<null>(`/templates/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  validate: (plan: unknown) =>
    request<ValidatePlanResponse>('/templates/validate', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  startRun: (body: StartRunRequest) =>
    request<RunDetail>('/runs', {
      method: 'POST',
      body: JSON.stringify({ ...body, language: activeLanguage() }),
    }),
  startRunWithProgress: streamRun,
  stopRun: (id: string) =>
    request<{ readonly stopping: true }>(`/runs/${id}/stop`, { method: 'POST' }),
  estimateRun: (body: StartRunRequest) =>
    request<RunEstimate>('/runs/estimate', {
      method: 'POST',
      body: JSON.stringify({ ...body, language: activeLanguage() }),
    }),
  runs: () => request<RunListResponse>('/runs'),
  run: (id: string) => request<RunDetail>(`/runs/${id}`),
  lagrangian: (scheme: CouplingScheme, scale: number | null) =>
    request<LagrangianResponse>(
      `/lagrangian?scheme=${scheme}${scale === null ? '' : `&scale=${String(scale)}`}`,
    ),
  process: (body: ProcessRequest) =>
    request<ProcessResult>('/processes', { method: 'POST', body: JSON.stringify(body) }),
  channels: (first: string, second: string) =>
    request<readonly string[]>(
      `/processes/channels?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`,
    ),
};
