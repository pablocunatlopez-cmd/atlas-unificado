import {diagnoseAtlasLocalCpu} from './atlas-local-cpu-diagnostics.mjs';
import {renderAtlasCommandCenter} from './atlas-command-center.mjs';
/**
 * Explicit, user-triggered dashboard diagnostic controller.
 * No polling, background work, model startup or remote network requests.
 */
export function createAtlasCpuDashboardController({
 readFreeRamMb,fetchImpl,endpoint='http://127.0.0.1:8080',
 currentTier='small',project='Atlas Unificado'
}={}){
 if(typeof readFreeRamMb!=='function')throw Error('Host memory reader required');
 let state=Object.freeze({phase:'idle',diagnostics:null,error:null});
 let running=false;
 return Object.freeze({
  get state(){return state;},
  render(){return renderAtlasCommandCenter({project,
   localDiagnostics:state.diagnostics});},
  async runDiagnostics(){
   if(running)throw Error('Diagnostics already running');
   running=true;state=Object.freeze({phase:'running',diagnostics:null,error:null});
   try{
    const freeRamMb=await readFreeRamMb();
    const diagnostics=await diagnoseAtlasLocalCpu({
     freeRamMb,fetchImpl,endpoint,currentTier
    });
    state=Object.freeze({phase:'completed',diagnostics,error:null});
    return state;
   }catch(error){
    state=Object.freeze({phase:'error',diagnostics:null,
     error:String(error?.message??'diagnostics_failed').slice(0,200)});
    return state;
   }finally{running=false;}
  }
 });
}
