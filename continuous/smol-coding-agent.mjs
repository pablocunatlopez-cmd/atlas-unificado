import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalCodingAgent} from './local-coding-agent.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export const SMOL_CODING_AGENT=Object.freeze({framework:'smolagents',version:'1.26.0',package:'smolagents',license:'Apache-2.0',source:'https://github.com/huggingface/smolagents',registry:'https://pypi.org/project/smolagents/1.26.0/',wheelSha256:'70e1cfb1576f782da93190ee31d9bb2659e5ca4bd84fda0c412e1f20498f28b6',model:'atlas-local',independentModels:false});
export function createSmolCodingAgent(options={}){
 return createLocalCodingAgent({...options,definition:SMOL_CODING_AGENT,helper:path.join(here,'smol-coding-agent.py'),readyFile:'smol-runtime-ready.json',statisticsFile:'smol-statistics.json'});
}
