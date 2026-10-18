/* Drafts: the experiments open in the builder tabs, each with its plan, last result, run state and live run progress. */
import type { ExperimentPlan, ExperimentResult, RunProgress } from '@standard-model/contracts';
import { emptyPlan } from './plan-edits';

export interface Draft {
  readonly id: number;
  readonly plan: ExperimentPlan;
  readonly result: ExperimentResult | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly progress?: RunProgress | null;
  readonly runId?: string | null;
  readonly stopping?: boolean;
}

let nextDraftId = 1;

export function createDraft(plan: ExperimentPlan = emptyPlan()): Draft {
  const draft: Draft = { id: nextDraftId, plan, result: null, busy: false, error: null };
  nextDraftId += 1;
  return draft;
}

export function patchDraft(
  drafts: readonly Draft[],
  id: number,
  patch: Partial<Draft>,
): readonly Draft[] {
  return drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft));
}
