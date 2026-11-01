import legacy from '../../data/studio-runtime-legacy.json' with {type:'json'};
import current from '../../data/studio-runtime.json' with {type:'json'};
// Replace only the byte-for-byte generated runtime. Edited code and stored
// revisions stay intact; the preview/export can use the bounded renderer.
export function compatibleRuntime(code){
 if(typeof code!=='string')throw Error('El proyecto no es texto.');
 if(!legacy.source||legacy.source===current.source)return code;
 const index=code.indexOf(legacy.source);if(index<0||code.indexOf(legacy.source,index+legacy.source.length)>=0)return code;
 return code.slice(0,index)+current.source+code.slice(index+legacy.source.length);
}
