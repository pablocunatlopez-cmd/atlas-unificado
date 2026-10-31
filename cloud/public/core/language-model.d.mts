export type ModelSnapshot = { format: string; steps: number; config: { context: number; embedding: number; hidden: number; vocabulary: number }; parameters: number; weights: Record<string, number[]> };
export const MODEL_FORMAT: string;
export const alphabet: string;
export const config: ModelSnapshot['config'];
export const parameterCount: number;
export function random(seed?: number): () => number;
export function encode(text: string): number[];
export function validateSnapshot(value: unknown): value is ModelSnapshot;
export class TinyLanguageModel {
  constructor(snapshot?: ModelSnapshot, seed?: number);
  steps: number;
  weights: Record<string, Float64Array>;
  forward(context: number[]): Float64Array;
  trainOne(context: number[], target: number, rate?: number): number;
  train(tokens: number[], steps?: number, seed?: number): number;
  evaluate(tokens: number[], samples?: number, seed?: number): number;
  generate(prompt?: string, length?: number, temperature?: number, seed?: number): string;
  snapshot(): ModelSnapshot;
}
