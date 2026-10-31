import type { ModelSnapshot } from '@/public/core/language-model.mjs';
import type {LearningState} from './atlas-spiral';
export type CorpusDoc = { id: string; title: string; text: string; date: string; url: string };
export type TrainingMetrics = { before: number; after: number; trainCharacters: number; validationCharacters: number; elapsedMs: number; attemptedSteps: number; improved: boolean; trainLoss?: number };
export type TrainingRecord = { id: string; date: string; corpusHash: string; metrics: TrainingMetrics; status: 'Promovido' | 'Descartado' | 'Inicial' | 'Restaurado' };
export type MissionStep = { tool: string; result: string; date: string; status: 'ok' | 'limitado' };
export type Mission = { id: string; goal: string; date: string; steps: MissionStep[]; summary: string; gaps: string[]; status: 'Resuelta' | 'Parcial' };
export type LabState = { documents: CorpusDoc[]; checkpoint: ModelSnapshot; previous?: ModelSnapshot; training: TrainingRecord[]; missions: Mission[]; learning?:LearningState };
