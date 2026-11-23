import type {Pattern} from './pattern.mjs';
export function transposePattern(raw:unknown,semitones:number):Pattern;
export function canTranspose(raw:unknown,semitones:number):boolean;
export function transpositionRange(raw:unknown):{min:number;max:number};
