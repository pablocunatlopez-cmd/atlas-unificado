import type {RetrievalProfile} from '../atlas-core';
import type {WebAttempt,WebResult} from './web';
import type {evaluateCandidate} from './evaluator';
export type ResearchSchedule={id:string;label:string;timezone:string;isEnabled:boolean};
export type ResearchControl={enabled:boolean;topicIndex:number;profile:RetrievalProfile;evaluatedVersions:string[];nextQuestion:string;lastRunAt:string|null;lastRunId:string|null;schedule?:ResearchSchedule;pendingFollowUp?:{question:string;query:string}};
export type StoredSource=WebResult&{id:string;hash:string;fetchedAt:string;runId:string};
export type ResearchRun={id:string;requestId:string;date:string;question:string;trigger:'manual'|'schedule';status:'Aprendizaje registrado'|'Sin novedad'|'Sin acceso'|'Restaurado';sourceIds:string[];repeated:number;attempts:WebAttempt[];phases:{name:string;result:string}[];evaluation:ReturnType<typeof evaluateCandidate>|null;evaluatorHash:string;negativeMemory:string[];nextQuestion:string;coverage:{before:number;after:number};elapsedMs:number};
export type ResearchPayload={control:ResearchControl;revision:number;stats:{sources:number;runs:number;learning:number};runs:ResearchRun[];sources:StoredSource[];busy:boolean;error?:string;run?:ResearchRun;search?:import('./web').WebSearch;paused?:boolean};
