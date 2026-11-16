/**
 * ERAS house integration contract. This bridge never creates a second renderer,
 * replaces the house camera, or changes the existing iframe protocol.
 * The host opts in and supplies its existing scene and renderer lifecycle.
 */
export function createAtlasErasHouseBridge({house,experience}={}){
 if(!house||!house.scene||!experience||
    typeof experience.mount!=='function'||typeof experience.unmount!=='function'||
    typeof experience.navigate!=='function'||typeof experience.tick!=='function')
  throw Error('Existing ERAS scene and Atlas experience required');
 let attached=false;
 function attach(){
  if(attached)throw Error('Bridge already attached');
  const result=experience.mount();
  attached=true;
  return Object.freeze({attached:true,atlasObjects:result.objects,
   rendererReused:true,houseCameraOwnership:'host'});
 }
 function navigate(id){
  if(!attached)throw Error('Bridge not attached');
  return experience.navigate(id);
 }
 function frame(elapsedMs){
  if(!attached)throw Error('Bridge not attached');
  return experience.tick(elapsedMs);
 }
 function detach(){
  if(!attached)return;
  experience.unmount();attached=false;
 }
 return Object.freeze({attach,navigate,frame,detach,
  get attached(){return attached;},
  rendererCreated:false,iframeProtocolModified:false,
  sceneRendered:false,authorizationGranted:false});
}
