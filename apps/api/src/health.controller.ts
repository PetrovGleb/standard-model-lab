/* Health endpoint: reports that the API is up and the database connection answers. */
import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@standard-model/contracts';
import type { Sequelize } from 'sequelize-typescript';
import { SEQUELIZE } from './database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(SEQUELIZE) private readonly connection: Sequelize) {}

  @Get()
  async health(): Promise<HealthResponse> {
    await this.connection.authenticate();
    return { status: 'ok', database: 'connected' };
  }
}
