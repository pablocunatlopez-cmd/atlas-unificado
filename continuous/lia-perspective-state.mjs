/** Pure, serializable projection state for a single Lía identity.
 * Views may nest; they never create separate agents or memories.
 */
export const LIA_MAX_DEPTH=6;
export const LIA_FOCI=Object.freeze(['mental','physical','god']);
export const initialLiaPerspective=Object.freeze({identity:'lia',depth:0,focus:'mental',yaw:0,mode:'spatial',revision:0});
export function transitionLiaPerspective(state,action){
 if(!state||state.identity!=='lia'||!Number.isInteger(state.depth)||state.depth<0||state.depth>LIA_MAX_DEPTH||!LIA_FOCI.includes(state.focus)||!Number.isInteger(state.revision)||state.revision<0)throw new TypeError('Invalid shared perspective state');
 if(!action||typeof action!=='object')throw new TypeError('Invalid perspective action');
 let next;
 switch(action.type){
  case 'enter':next={...state,depth:Math.min(LIA_MAX_DEPTH,state.depth+1)};break;
  case 'exit':next={...state,depth:Math.max(0,state.depth-1)};break;
  case 'focus':
   if(!LIA_FOCI.includes(action.focus))throw new TypeError('Unknown spiral vertex');
   next={...state,focus:action.focus};break;
  case 'rotate':
   if(!Number.isFinite(action.degrees)||Math.abs(action.degrees)>90)throw new RangeError('Invalid rotation');
   next={...state,yaw:((state.yaw+action.degrees)%360+360)%360};break;
  case 'mode':
   if(!['spatial','static'].includes(action.mode))throw new TypeError('Invalid view mode');
   next={...state,mode:action.mode};break;
  case 'reset':next={...initialLiaPerspective,revision:state.revision};break;
  default:throw new TypeError('Unknown perspective action');
 }
 const changed=Object.keys(next).some(key=>next[key]!==state[key]);
 return Object.freeze({...next,revision:state.revision+(changed?1:0)});
}
export function liaPerspectiveLevels(state){
 if(state?.identity!=='lia'||!Number.isInteger(state.depth)||state.depth<0||state.depth>LIA_MAX_DEPTH)throw new TypeError('Invalid depth');
 return Object.freeze(Array.from({length:state.depth+1},(_,depth)=>Object.freeze({identity:'lia',depth,focus:state.focus,active:depth===state.depth})));
}
