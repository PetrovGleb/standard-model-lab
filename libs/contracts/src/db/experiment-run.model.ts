/* Sequelize model: one execution of a plan with resolved parameters, shot count, seed and status. */
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasOne,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import type { ExperimentPlan, ParameterDefinitions } from '../experiment-plan.js';
import { RUN_STATUSES, type RunStatus } from '../run-status.js';
import { ExperimentTemplate } from './experiment-template.model.js';
import { RunResult } from './run-result.model.js';

@Table({ tableName: 'experiment_runs', underscored: true, timestamps: true })
export class ExperimentRun extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  override id!: string;

  @ForeignKey(() => ExperimentTemplate)
  @Column(DataType.UUID)
  templateId!: string | null;

  @BelongsTo(() => ExperimentTemplate)
  template?: ExperimentTemplate;

  @Column(DataType.STRING)
  templateName!: string | null;

  @AllowNull(false)
  @Column(DataType.JSONB)
  plan!: ExperimentPlan;

  @AllowNull(false)
  @Column(DataType.JSONB)
  parameters!: ParameterDefinitions;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  shots!: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  seed!: number;

  @AllowNull(false)
  @Default('pending')
  @Column(DataType.ENUM(...RUN_STATUSES))
  status!: RunStatus;

  @Column(DataType.DATE)
  startedAt!: Date | null;

  @Column(DataType.DATE)
  finishedAt!: Date | null;

  @Column(DataType.TEXT)
  errorMessage!: string | null;

  @Column(DataType.INTEGER)
  elapsedMilliseconds!: number | null;

  @HasOne(() => RunResult)
  result?: RunResult;
}
