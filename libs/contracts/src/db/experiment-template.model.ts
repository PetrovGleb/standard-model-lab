/* Sequelize model: a saved experiment template, an ExperimentPlan with default parameters. */
import {
  AllowNull,
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import type { ExperimentPlan } from '../experiment-plan.js';
import { ExperimentRun } from './experiment-run.model.js';

@Table({ tableName: 'experiment_templates', underscored: true, timestamps: true })
export class ExperimentTemplate extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  override id!: string;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  name!: string;

  @Column(DataType.TEXT)
  description!: string | null;

  @AllowNull(false)
  @Column(DataType.JSONB)
  plan!: ExperimentPlan;

  @HasMany(() => ExperimentRun)
  runs?: ExperimentRun[];
}
