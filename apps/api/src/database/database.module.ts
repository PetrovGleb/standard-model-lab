/* DatabaseModule: one Sequelize connection from the environment, synchronised on start (no migrations) and closed on shutdown. */
import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  createDatabaseConnection,
  readDatabaseConfigFromEnvironment,
} from '@standard-model/contracts/db';
import type { Sequelize } from 'sequelize-typescript';

export const SEQUELIZE = Symbol('SEQUELIZE');

async function connect(): Promise<Sequelize> {
  const connection = createDatabaseConnection(readDatabaseConfigFromEnvironment(process.env));
  await connection.authenticate();
  await connection.sync({ alter: true });
  return connection;
}

@Module({
  providers: [{ provide: SEQUELIZE, useFactory: connect }],
  exports: [SEQUELIZE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(SEQUELIZE) private readonly connection: Sequelize) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
