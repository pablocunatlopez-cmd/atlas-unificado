/**
 * Atlas tool catalog: metadata only. No install, spawn, download or API calls.
 * Local-first tools remain opt-in and disabled until verified by the host.
 */
export const ATLAS_FREE_TOOL_CATALOG=Object.freeze([
 Object.freeze({id:'llama-cpp',repo:'ggml-org/llama.cpp',role:'local-inference',priority:0,
  integration:'existing-local-http-client',cpuFriendly:true,defaultEnabled:false}),
 Object.freeze({id:'whisper-cpp',repo:'ggml-org/whisper.cpp',role:'local-speech',priority:1,
  integration:'existing-local-cli-client',cpuFriendly:true,defaultEnabled:false}),
 Object.freeze({id:'aider',repo:'Aider-AI/aider',role:'git-aware-code-edits',priority:2,
  integration:'reviewed-external-cli',cpuFriendly:false,defaultEnabled:false}),
 Object.freeze({id:'opencode',repo:'anomalyco/opencode',role:'coding-agent-reference',priority:3,
  integration:'architecture-reference-only',cpuFriendly:false,defaultEnabled:false}),
 Object.freeze({id:'openhands',repo:'All-Hands-AI/OpenHands',role:'sandboxed-agent-reference',priority:4,
  integration:'architecture-reference-only',cpuFriendly:false,defaultEnabled:false})
]);
const IDS=new Set(ATLAS_FREE_TOOL_CATALOG.map(x=>x.id));
export function planAtlasFreeToolAdoption({installed=[],approved=[]}={}){
 if(!Array.isArray(installed)||!Array.isArray(approved)||
  installed.some(x=>typeof x!=='string'||!IDS.has(x))||
  approved.some(x=>typeof x!=='string'||!IDS.has(x)))
  throw Error('Invalid tool adoption state');
 const present=new Set(installed),authorized=new Set(approved);
 return Object.freeze(ATLAS_FREE_TOOL_CATALOG.map(tool=>Object.freeze({
  ...tool,installed:present.has(tool.id),approved:authorized.has(tool.id),
  status:!authorized.has(tool.id)?'approval_required':
   !present.has(tool.id)?'installation_required':'ready_for_host_verification',
  executable:false,automaticInstallation:false
 })));
}
