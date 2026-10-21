/* Sequelize model: aggregated output of a run, the report statistics, per-record outcome counts, traced system reports, the keyframe summary and the mean time each step took per shot. */
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import type {
  Distributions,
  KeyframeSummary,
  OutcomeCounts,
  ReportValues,
  SystemReport,
} from '../experiment-result.js';
import { ExperimentRun } from './experiment-run.model.js';

@Table({ tableName: 'run_results', underscored: true, timestamps: true })
export class RunResult extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  override id!: string;

  @ForeignKey(() => ExperimentRun)
  @AllowNull(false)
  @Unique
  @Column(DataType.UUID)
  runId!: string;

  @BelongsTo(() => ExperimentRun)
  run?: ExperimentRun;

  @AllowNull(false)
  @Column(DataType.JSONB)
  reportValues!: ReportValues;

  @AllowNull(false)
  @Column(DataType.JSONB)
  outcomeCounts!: OutcomeCounts;

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSONB)
  distributions!: Distributions;

  @Column(DataType.JSONB)
  systemReport!: SystemReport | null;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  systemReports!: SystemReport[];

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSONB)
  stepMeanMilliseconds!: number[];

  @Column(DataType.JSONB)
  keyframes!: KeyframeSummary | null;
}
