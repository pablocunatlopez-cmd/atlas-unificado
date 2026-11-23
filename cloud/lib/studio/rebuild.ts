import type {Brief,StudioMode} from './scene.ts';
import type {generateProject} from './generator.ts';
import {validateCreativePlan} from '../creative/plan.mjs';

type GenerationOptions=NonNullable<Parameters<typeof generateProject>[2]>;
export type RebuildInput={prompt:string;mode:StudioMode;seed?:number;quality?:'balanced'|'high';lighting?:Brief['lighting'];palette?:string};
export type RebuildSource={prompt:string;mode:StudioMode;brief:Brief};

export class StudioRedesignRequiredError extends Error{
 readonly code='AI_REDESIGN_REQUIRED';
 readonly href:string;
 constructor(mode:StudioMode){
  const href=mode==='game'?'/?room=games':'/?room=lab';
  super('Este proyecto tiene un diseño creado por IA. Para cambiar la descripción o el tipo de proyecto, encarga un nuevo diseño en el taller: '+href+'. Tu composición y sus versiones se conservan.');
  this.href=href;
 }
}

/** Configuration rebuilds preserve authored geometry. A new brief needs an
 * explicit model job; silently parsing it as a preset would discard the design. */
export function studioRebuildOptions(input:RebuildInput,existing?:RebuildSource|null):GenerationOptions{
 const explicit:GenerationOptions={...(input.seed!==undefined?{seed:input.seed}:{}),...(input.quality!==undefined?{quality:input.quality}:{}),...(input.lighting!==undefined?{lighting:input.lighting}:{}),...(input.palette!==undefined?{palette:input.palette}:{})};
 if(!existing?.brief.plan)return explicit;
 if(input.mode!==existing.mode||input.prompt.trim()!==existing.prompt.trim())throw new StudioRedesignRequiredError(input.mode);
 const previous=existing.brief,authored=previous.plan!;
 const plan=validateCreativePlan({version:authored.version??1,title:previous.title,variant:previous.variant,lighting:input.lighting??previous.lighting,palette:input.palette??previous.palette,objects:structuredClone(authored.objects),design:authored.design??'',...(authored.version===2?{...(authored.materials?{materials:structuredClone(authored.materials)}:{}),...(authored.camera?{camera:[...authored.camera]}:{}),...(authored.target?{target:[...authored.target]}:{})}:{})},input.mode);
 return{seed:previous.seed,quality:previous.quality,lighting:previous.lighting,palette:previous.palette,...explicit,plan};
}
