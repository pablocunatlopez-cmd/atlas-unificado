import {validatePattern} from './pattern.mjs';

/**
 * Move every stored bass note by the same number of semitones. Keeping the
 * offset exact preserves melodic intervals; clipping at the MIDI limits would
 * change the melody, so unsupported shifts are rejected instead.
 * @param {unknown} raw
 * @param {number} semitones
 */
export function transposePattern(raw,semitones){
 if(!Number.isInteger(semitones)||semitones< -12||semitones>12)throw Error('La transposición debe ser un número entero entre −12 y +12 semitonos.');
 const pattern=validatePattern(raw),notes=pattern.bassNotes.map(note=>note+semitones);
 if(notes.some(note=>note<36||note>72))throw Error('La transposición dejaría notas fuera del rango MIDI 36–72. Elige menos semitonos.');
 return{...pattern,bassNotes:notes};
}

/** @param {unknown} raw @param {number} semitones */
export function canTranspose(raw,semitones){
 try{transposePattern(raw,semitones);return true;}catch{return false;}
}

/** @param {unknown} raw */
export function transpositionRange(raw){
 const {bassNotes}=validatePattern(raw);
 return{min:Math.max(-12,36-Math.min(...bassNotes)),max:Math.min(12,72-Math.max(...bassNotes))};
}
