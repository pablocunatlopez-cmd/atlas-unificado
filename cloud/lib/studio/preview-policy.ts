import type {StudioProject} from './types.ts';
import {compileGraphic} from './generator.ts';
import {compatibleRuntime} from './runtime-compat.mjs';

/** Old saved HTML has no metadata. Use ERAS automatically only when the source
 * is known generated code; custom scripts and unsaved edits remain portable. */
export function studioPreviewMode(project:StudioProject,source:string):'eras'|'html'{
 if(!['3d','image'].includes(project.mode)||project.brief.preview==='html'||source!==project.code)return 'html';
 if(project.brief.preview==='eras')return 'eras';
 try{return compatibleRuntime(source)===compileGraphic(project.brief)?'eras':'html';}catch{return 'html';}
}
