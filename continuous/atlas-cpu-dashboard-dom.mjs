/**
 * Trusted host binding for the Atlas CPU diagnostics button.
 * The host provides a DOM root and a controller. No implicit checks.
 */
export function mountAtlasCpuDiagnosticsButton({root,controller,onRender}={}){
 if(!root||typeof root.addEventListener!=='function'||
  typeof root.removeEventListener!=='function'||
  !controller||typeof controller.runDiagnostics!=='function'||
  typeof controller.render!=='function'||
  typeof onRender!=='function')
  throw Error('Trusted DOM host, controller and renderer required');
 let disposed=false,busy=false;
 const handler=async event=>{
  const target=event?.target;
  if(disposed||busy||!target||typeof target.closest!=='function')return;
  const button=target.closest('[data-action="run-cpu-diagnostics"]');
  if(!button||typeof root.contains!=='function'||!root.contains(button))return;
  busy=true;
  try{
   await controller.runDiagnostics();
   if(!disposed)onRender(controller.render());
  }finally{busy=false;}
 };
 root.addEventListener('click',handler);
 return Object.freeze({
  dispose(){if(disposed)return;disposed=true;root.removeEventListener('click',handler);},
  get busy(){return busy;}
 });
}
