/* Physics endpoints: GET /api/lagrangian with scheme and scale, POST /api/processes for tree-level cross sections and widths. */
import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import type { LagrangianResponse, ProcessResult } from '@standard-model/contracts';
import { PhysicsService } from './physics.service.js';

const STATUS_OK = 200;

@Controller()
export class PhysicsController {
  constructor(@Inject(PhysicsService) private readonly physics: PhysicsService) {}

  @Get('lagrangian')
  lagrangian(@Query('scheme') scheme?: string, @Query('scale') scale?: string): LagrangianResponse {
    return this.physics.lagrangian(scheme, scale);
  }

  @Get('processes/channels')
  channels(@Query('first') first?: string, @Query('second') second?: string): readonly string[] {
    return this.physics.channels(first, second);
  }

  @Post('processes')
  @HttpCode(STATUS_OK)
  calculate(@Body() body: unknown): ProcessResult {
    return this.physics.calculate(body);
  }
}
