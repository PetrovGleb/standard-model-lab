/* End-to-end API test against the real Postgres from .env; skipped when no database is configured. */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  PARTICLE_NAMES,
  textIn,
  type CatalogResponse,
  type NuclideEntry,
  type RunDetail,
  type RunStreamMessage,
  type RunListResponse,
  type TemplateDetail,
  type TemplateListResponse,
  type ValidatePlanResponse,
} from '@standard-model/contracts';
import { ExperimentRun, ExperimentTemplate, RunResult } from '@standard-model/contracts/db';
import { experiment } from '@standard-model/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

const hasDatabase = process.env.POSTGRES_HOST !== undefined && process.env.POSTGRES_HOST !== '';
const TEMPLATE_NAME = `e2eTemplate${String(Date.now())}`;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const OXYGEN = 8;
const LONG_RUN_SHOTS = 200_000;

describe.skipIf(!hasDatabase)('API end to end', () => {
  let app: INestApplication;
  let baseUrl: string;
  const createdRunIds: string[] = [];

  async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    return { status: response.status, body: (text === '' ? null : JSON.parse(text)) as T };
  }

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await RunResult.destroy({ where: { runId: createdRunIds } });
    await ExperimentRun.destroy({ where: { id: createdRunIds } });
    await ExperimentTemplate.destroy({ where: { name: TEMPLATE_NAME } });
    await app.close();
  });

  it('serves health and the catalog', async () => {
    expect((await call<{ status: string }>('/health')).body.status).toBe('ok');
    const catalog = (await call<CatalogResponse>('/catalog')).body;
    expect(catalog.particles).toHaveLength(PARTICLE_NAMES.length);
    expect(catalog.influences.map((influence) => influence.name)).toContain('travel');
    expect(
      catalog.influences.find((influence) => influence.name === 'evolve')?.parameters[0]?.name,
    ).toBe('durationInSeconds');
    expect(
      catalog.particles.find((particle) => particle.name === 'photon')?.observables[0]?.name,
    ).toBe('polarization');
    expect(
      catalog.presets.magneticFieldInTesla.some((entry) =>
        textIn(entry.label, 'en').includes('Schwinger'),
      ),
    ).toBe(true);
    expect(catalog.presets.momentumInGevByParticle.muon?.length ?? 0).toBeGreaterThan(1);
    expect(catalog.operations).toContain('measure');
    expect(catalog.elements.find((element) => element.protons === OXYGEN)?.label?.ru).toBe(
      'Кислород',
    );
    expect(
      catalog.molecules?.find((entry) => entry.key === 'water')?.massInDaltons,
    ).toBeGreaterThan(18);
  });

  it('serves the measured nuclides of one element', async () => {
    const oxygen = await call<readonly NuclideEntry[]>(`/catalog/nuclides/${String(OXYGEN)}`);
    expect(
      oxygen.body.filter((nuclide) => nuclide.stable).map((nuclide) => nuclide.massNumber),
    ).toEqual([16, 17, 18]);
    expect(oxygen.body.find((nuclide) => nuclide.massNumber === 15)?.decayMode).toBe('B+');
    expect((await call('/catalog/nuclides/999')).status).toBe(HTTP_BAD_REQUEST);
  });

  it('stops a streamed run before its next shot and keeps the finished shots', async () => {
    const response = await fetch(`${baseUrl}/api/runs/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template: 'sternGerlach', shots: LONG_RUN_SHOTS, seed: 3 }),
    });
    const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
    const messages: RunStreamMessage[] = [];
    let buffer = '';
    let stopStatus: number | null = null;
    while (reader !== undefined) {
      const { value, done } = await reader.read();
      buffer += value ?? '';
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines.filter((candidate) => candidate.trim() !== '')) {
        const message = JSON.parse(line) as RunStreamMessage;
        messages.push(message);
        if (message.kind === 'started') {
          createdRunIds.push(message.runId);
          stopStatus = (await call(`/runs/${message.runId}/stop`, { method: 'POST' })).status;
        }
      }
      if (done) {
        break;
      }
    }
    expect(stopStatus).toBe(HTTP_CREATED);
    const finished = messages.find((message) => message.kind === 'done');
    expect(finished?.kind === 'done' ? finished.detail.run.status : null).toBe('stopped');
    expect(finished?.kind === 'done' ? finished.detail.result?.stopped : null).toBe(true);
    expect(finished?.kind === 'done' ? finished.detail.run.shots : LONG_RUN_SHOTS).toBeLessThan(
      LONG_RUN_SHOTS,
    );
    expect(
      (await call('/runs/00000000-0000-0000-0000-000000000000/stop', { method: 'POST' })).status,
    ).toBe(HTTP_CONFLICT);
  });

  it('lists built-in templates and runs one', async () => {
    const list = (await call<TemplateListResponse>('/templates')).body;
    expect(list.templates.map((template) => template.name)).toContain('sternGerlach');
    const started = await call<RunDetail>('/runs', {
      method: 'POST',
      body: JSON.stringify({
        template: 'sternGerlach',
        parameters: { polarAngleDegrees: 0 },
        shots: 100,
        seed: 2,
      }),
    });
    expect(started.status).toBe(HTTP_CREATED);
    createdRunIds.push(started.body.run.id);
    expect(started.body.run.status).toBe('finished');
    expect(started.body.result?.reportValues['spin[0.5]']).toBe(1);
    const fetched = (await call<RunDetail>(`/runs/${started.body.run.id}`)).body;
    expect(fetched.result?.outcomeCounts.spin).toEqual({ '0.5': 100 });
    const history = (await call<RunListResponse>('/runs?limit=5')).body;
    expect(history.runs.some((run) => run.id === started.body.run.id)).toBe(true);
  });

  it('validates, saves, runs and refuses duplicate custom templates', async () => {
    const plan = experiment(TEMPLATE_NAME)
      .describe('e2e')
      .parameter('angle', 90)
      .create('e', 'electron', { spin: 'up' })
      .measure('e', 'spin', 'spin', { polarAngleDegrees: '{{angle}}', azimuthDegrees: 0 })
      .report('frequency', ['spin'], 'spin')
      .build();
    const invalid = await call<ValidatePlanResponse>('/templates/validate', {
      method: 'POST',
      body: JSON.stringify({ plan: { ...plan, steps: [] } }),
    });
    expect(invalid.body.valid).toBe(false);
    expect(textIn(invalid.body.errors[0] ?? '', 'en')).toContain('invalid plan');
    const saved = await call<TemplateDetail>('/templates', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    expect(saved.status).toBe(HTTP_CREATED);
    expect(saved.body.source).toBe('saved');
    const duplicate = await call<TemplateDetail>('/templates', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    expect(duplicate.status).toBe(HTTP_CONFLICT);
    const run = await call<RunDetail>('/runs', {
      method: 'POST',
      body: JSON.stringify({ template: TEMPLATE_NAME, shots: 50, seed: 3 }),
    });
    expect(run.status).toBe(HTTP_CREATED);
    createdRunIds.push(run.body.run.id);
    expect(run.body.run.templateName).toBe(TEMPLATE_NAME);
    const badRun = await call<unknown>('/runs', {
      method: 'POST',
      body: JSON.stringify({ template: 'nope' }),
    });
    expect(badRun.status).toBe(HTTP_NOT_FOUND);
    const tooMany = await call<unknown>('/runs', {
      method: 'POST',
      body: JSON.stringify({ template: 'sternGerlach', shots: 1_000_000 }),
    });
    expect(tooMany.status).toBe(HTTP_BAD_REQUEST);
  });
});
