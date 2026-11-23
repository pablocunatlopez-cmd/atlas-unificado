export const ERAS_BRIDGE_TYPES=Object.freeze(['ready','loaded','error','snapshot'] as const);
export const ERAS_SNAPSHOT_MAX_LENGTH=22_000_000;
type Backend='WebGPU'|'WebGL2';
export type ErasBridgeMessage=
 |{type:'ready';requestId?:string;backend?:Backend;message?:string}
 |{type:'loaded';requestId:string;backend:Backend;message?:string}
 |{type:'error';requestId:string;message:string}
 |{type:'snapshot';requestId:string;data:string};

function plain(value:unknown):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null;
}
const backend=(value:unknown):value is Backend=>value==='WebGPU'||value==='WebGL2';
const boundedMessage=(value:unknown)=>typeof value==='string'?value.trim().slice(0,500):undefined;
function snapshot(value:unknown):value is string{
 if(typeof value!=='string'||value.length>ERAS_SNAPSHOT_MAX_LENGTH)return false;
 const prefix='data:image/png;base64,';if(!value.startsWith(prefix))return false;
 const body=value.slice(prefix.length);
 // Browser snapshots are PNGs. Check their signature as well as the URL MIME
 // and alphabet so a renderer message cannot substitute another download type.
 return body.startsWith('iVBORw0KGgo')&&body.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(body);
}

/** Validate the renderer's payload after the caller checks event.source and
 * event.origin. This helper cannot authenticate a window or an origin itself. */
export function readErasMessage(data:unknown,expectedRequestId:string):ErasBridgeMessage|null{
 try{
  if(!plain(data)||!Object.hasOwn(data,'erasEngine')||data.erasEngine!==true||!Object.hasOwn(data,'type'))return null;
  const type=data.type;if(typeof type!=='string'||!ERAS_BRIDGE_TYPES.includes(type as typeof ERAS_BRIDGE_TYPES[number]))return null;
  const id=data.requestId,matching=typeof expectedRequestId==='string'&&!!expectedRequestId.trim()&&expectedRequestId.length<=200&&id===expectedRequestId;
  if(type==='ready'){
   if(id!==undefined&&!matching||data.backend!==undefined&&!backend(data.backend)||data.message!==undefined&&typeof data.message!=='string')return null;
   return{type:'ready',...(matching?{requestId:expectedRequestId}:{}),...(backend(data.backend)?{backend:data.backend}:{}),...(boundedMessage(data.message)?{message:boundedMessage(data.message)}:{})};
  }
  if(!matching)return null;
  if(type==='loaded'){
   if(!backend(data.backend)||data.message!==undefined&&typeof data.message!=='string')return null;
   return{type:'loaded',requestId:expectedRequestId,backend:data.backend,...(boundedMessage(data.message)?{message:boundedMessage(data.message)}:{})};
  }
  if(type==='error'){
   const message=boundedMessage(data.message);return message?{type:'error',requestId:expectedRequestId,message}:null;
  }
  return snapshot(data.data)?{type:'snapshot',requestId:expectedRequestId,data:data.data}:null;
 }catch{return null;}
}
