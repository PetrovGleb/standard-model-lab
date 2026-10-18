/* Runs endpoints: start a run, start one that streams its id, its progress as JSON lines and the result, stop an active run (also when the streaming client goes away), list recent
   runs, fetch one run with its result. */
import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type {
  RunDetail,
  RunEstimate,
  RunListResponse,
  RunProgress,
  RunStreamMessage,
  StartRunRequest,
} from '@standard-model/contracts';
import { textOf } from '../http-errors.js';
import { RunsService } from './runs.service.js';

const PROGRESS_INTERVAL_IN_MILLISECONDS = 200;
const INTERNAL_ERROR = 500;

interface StreamResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', listener: () => void): void;
  readonly writableFinished: boolean;
}

function errorMessage(failure: unknown): RunStreamMessage {
  if (failure instanceof HttpException) {
    const response = failure.getResponse();
    return {
      kind: 'error',
      error:
        typeof response === 'object'
          ? (response as Extract<RunStreamMessage, { kind: 'error' }>['error'])
          : { statusCode: failure.getStatus(), message: String(response) },
    };
  }
  const text = textOf(failure);
  return { kind: 'error', error: { statusCode: INTERNAL_ERROR, message: text.en, text } };
}

@Controller('runs')
export class RunsController {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  @Post()
  start(@Body() body: StartRunRequest): Promise<RunDetail> {
    return this.runs.start(body);
  }

  @Post('estimate')
  estimate(@Body() body: StartRunRequest): Promise<RunEstimate> {
    return this.runs.estimate(body);
  }

  @Post('stream')
  async stream(@Body() body: StartRunRequest, @Res() response: StreamResponse): Promise<void> {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    const send = (message: RunStreamMessage): void => {
      response.write(`${JSON.stringify(message)}\n`);
    };
    let lastSent = 0;
    const onProgress = (progress: RunProgress): void => {
      const now = Date.now();
      const final = progress.phase !== 'shots' || progress.completedShots === progress.totalShots;
      if (
        final ||
        progress.completedShots === 1 ||
        now - lastSent >= PROGRESS_INTERVAL_IN_MILLISECONDS
      ) {
        lastSent = now;
        send({ kind: 'progress', progress });
      }
    };
    let runId: string | null = null;
    let finished = false;
    response.on('close', () => {
      if (!finished && runId !== null) {
        try {
          this.runs.stop(runId);
        } catch {
          return;
        }
      }
    });
    try {
      const detail = await this.runs.start(body, onProgress, (id) => {
        runId = id;
        send({ kind: 'started', runId: id });
      });
      send({ kind: 'done', detail });
    } catch (failure) {
      send(errorMessage(failure));
    }
    finished = true;
    response.end();
  }

  @Post(':id/stop')
  stop(@Param('id') id: string): { readonly stopping: true } {
    return this.runs.stop(id);
  }

  @Get()
  async list(@Query('limit') limit?: string): Promise<RunListResponse> {
    const parsed = limit === undefined ? undefined : Number(limit);
    return {
      runs: await this.runs.list(
        parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
      ),
    };
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<RunDetail> {
    return this.runs.get(id);
  }
}
