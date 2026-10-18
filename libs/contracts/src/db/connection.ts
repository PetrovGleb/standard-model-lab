/* Database connection factory: reads Postgres settings from the environment and builds a sequelize-typescript instance with every model registered. */
import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { ExperimentRun } from './experiment-run.model.js';
import { ExperimentTemplate } from './experiment-template.model.js';
import { RunResult } from './run-result.model.js';

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
}

export const DATABASE_MODELS = [ExperimentTemplate, ExperimentRun, RunResult];

function requireVariable(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
}

export function readDatabaseConfigFromEnvironment(environment: NodeJS.ProcessEnv): DatabaseConfig {
  return {
    host: requireVariable(environment, 'POSTGRES_HOST'),
    port: Number(requireVariable(environment, 'POSTGRES_PORT')),
    database: requireVariable(environment, 'POSTGRES_DB'),
    username: requireVariable(environment, 'POSTGRES_USER'),
    password: requireVariable(environment, 'POSTGRES_PASSWORD'),
  };
}

export function createDatabaseConnection(config: DatabaseConfig): Sequelize {
  return new Sequelize({
    dialect: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    models: DATABASE_MODELS,
    logging: false,
  });
}
