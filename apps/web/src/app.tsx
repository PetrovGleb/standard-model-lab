/* Application shell: navigation plus the builder drafts, held here so the builder tabs and the results page share one experiment. */
import type { ExperimentPlan, Language } from '@standard-model/contracts';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { DataSources } from './components/data-sources';
import { SmlIcon } from './components/sml-icon';
import { ErrorBoundary } from './components/error-boundary';
import { LanguageSwitch } from './components/language-switch';
import type { RunSettings } from './components/parameter-form';
import { TooltipLayer } from './components/tooltip-layer';
import { createDraft, patchDraft, type Draft } from './drafts';
import { LanguageContext, activeLanguage, bilingual, setActiveLanguage } from './language';
import { emptyPlan } from './plan-edits';
import { BuilderView } from './views/builder-view';
import { LagrangianView } from './views/lagrangian-view';
import { ResultsView } from './views/results-view';
import { RunsView } from './views/runs-view';
import { TemplatesView } from './views/templates-view';

type View = 'templates' | 'builder' | 'results' | 'runs' | 'lagrangian';

const VIEW_ICONS: Readonly<Record<View, string>> = {
  templates: 'templates',
  builder: 'builder',
  results: 'results',
  runs: 'history',
  lagrangian: 'lagrangian',
};

const VIEW_TITLES = bilingual<View>({
  templates: ['Шаблоны', 'Templates'],
  builder: ['Конструктор', 'Builder'],
  results: ['Результат', 'Result'],
  runs: ['История', 'History'],
  lagrangian: ['Лагранжиан', 'Lagrangian'],
});

interface DraftState {
  readonly drafts: readonly Draft[];
  readonly activeId: number;
}

function initialDraftState(): DraftState {
  const first = createDraft();
  return { drafts: [first], activeId: first.id };
}

const RUN_ENDED = { busy: false, progress: null, runId: null, stopping: false } as const;

export function App() {
  const [language, setLanguage] = useState<Language>(activeLanguage);
  const [view, setView] = useState<View>('templates');
  const [state, setState] = useState<DraftState>(initialDraftState);
  const active = state.drafts.find((draft) => draft.id === state.activeId) ?? null;
  const topbar = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = topbar.current;
    if (header === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--topbar-height',
        `${String(header.getBoundingClientRect().height)}px`,
      );
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const switchLanguage = (next: Language): void => {
    setActiveLanguage(next);
    setLanguage(next);
  };

  const openDraft = (plan: ExperimentPlan): void => {
    const draft = createDraft(plan);
    setState((current) => ({ drafts: [...current.drafts, draft], activeId: draft.id }));
    setView('builder');
  };

  const closeDraft = (id: number): void => {
    setState((current) => {
      const remaining = current.drafts.filter((draft) => draft.id !== id);
      if (remaining.length === 0) {
        return initialDraftState();
      }
      const activeId =
        current.activeId === id
          ? (remaining[remaining.length - 1]?.id ?? current.activeId)
          : current.activeId;
      return { drafts: remaining, activeId };
    });
  };

  const patch = (id: number, changes: Partial<Draft>): void => {
    setState((current) => ({ ...current, drafts: patchDraft(current.drafts, id, changes) }));
  };

  const runTemplate = (plan: ExperimentPlan, settings: RunSettings): void => {
    const draft: Draft = {
      ...createDraft({
        ...plan,
        parameters: { ...plan.parameters, ...settings.parameters },
        shots: settings.shots,
        seed: settings.seed,
      }),
      busy: true,
    };
    setState((current) => ({ drafts: [...current.drafts, draft], activeId: draft.id }));
    setView('results');
    api
      .startRunWithProgress(
        { template: plan.name, ...settings },
        (progress) => patch(draft.id, { progress }),
        (runId) => patch(draft.id, { runId }),
      )
      .then((detail) => patch(draft.id, { result: detail.result, ...RUN_ENDED }))
      .catch((failure: Error) => patch(draft.id, { error: failure.message, ...RUN_ENDED }));
  };

  const runDraft = (id: number): void => {
    const draft = state.drafts.find((candidate) => candidate.id === id);
    if (draft === undefined) {
      return;
    }
    patch(id, { busy: true, error: null, progress: null });
    setView('results');
    api
      .startRunWithProgress(
        { plan: draft.plan },
        (progress) => patch(id, { progress }),
        (runId) => patch(id, { runId }),
      )
      .then((detail) => patch(id, { result: detail.result, ...RUN_ENDED }))
      .catch((failure: Error) => patch(id, { error: failure.message, ...RUN_ENDED }));
  };

  const stopDraft = (id: number): void => {
    const runId = state.drafts.find((candidate) => candidate.id === id)?.runId;
    if (runId === undefined || runId === null) {
      return;
    }
    patch(id, { stopping: true });
    api.stopRun(runId).catch(() => patch(id, { stopping: false }));
  };

  return (
    <LanguageContext.Provider value={language}>
      <div className="shell">
        <TooltipLayer />
        <header className="topbar" ref={topbar}>
          <div className="brand">
            <picture className="wordmark">
              <source
                srcSet="/brand/logo-horizontal-on-dark.svg"
                media="(prefers-color-scheme: dark)"
              />
              <img src="/brand/logo-horizontal-on-light.svg" alt="standard model lab" />
            </picture>
          </div>
          <nav>
            {(Object.keys(VIEW_TITLES) as View[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={candidate === view ? 'tab active' : 'tab'}
                onClick={() => setView(candidate)}
              >
                <SmlIcon name={VIEW_ICONS[candidate]} aria-hidden="true" size={16} />
                {VIEW_TITLES[candidate]}
              </button>
            ))}
          </nav>
          <div className="topbar-tools">
            <LanguageSwitch language={language} onChange={switchLanguage} />
            <DataSources />
          </div>
        </header>
        <main>
          <ErrorBoundary key={view} onReset={() => setView('builder')}>
            {view === 'templates' && <TemplatesView onEdit={openDraft} onRun={runTemplate} />}
            {view === 'builder' && (
              <BuilderView
                drafts={state.drafts}
                activeId={state.activeId}
                onSelect={(id) => setState((current) => ({ ...current, activeId: id }))}
                onNew={() => openDraft(emptyPlan())}
                onClose={closeDraft}
                onChange={(id, plan) => patch(id, { plan })}
                onClear={(id) => patch(id, { plan: emptyPlan(), result: null, error: null })}
                onRun={runDraft}
              />
            )}
            {view === 'results' && (
              <ResultsView
                draft={active}
                onStop={() => {
                  if (active !== null) {
                    stopDraft(active.id);
                  }
                }}
                onEdit={() => setView('builder')}
                onCarryOver={openDraft}
              />
            )}
            {view === 'runs' && <RunsView onCarryOver={openDraft} />}
            {view === 'lagrangian' && <LagrangianView />}
          </ErrorBoundary>
        </main>
      </div>
    </LanguageContext.Provider>
  );
}
