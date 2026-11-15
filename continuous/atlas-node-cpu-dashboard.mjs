import {probeAtlasCpuHardware} from './atlas-cpu-hardware-probe.mjs';
import {createAtlasCpuDashboardController} from './atlas-cpu-dashboard-controller.mjs';
import {mountAtlasCpuDiagnosticsButton} from './atlas-cpu-dashboard-dom.mjs';
/**
 * Node host integration for a trusted, already-mounted DOM root.
 * The host decides when to mount and is responsible for DOM lifecycle.
 * Never reads RAM or contacts localhost until a button is clicked.
 */
export function mountAtlasNodeCpuDashboard({
 root,renderHtml,fetchImpl,osApi,endpoint='http://127.0.0.1:8080'
}={}){
 if(!root||typeof renderHtml!=='function')
  throw Error('Trusted dashboard mount required');
 const controller=createAtlasCpuDashboardController({
  readFreeRamMb:()=>probeAtlasCpuHardware(osApi?{osApi}:undefined).freeRamMb,
  fetchImpl,endpoint
 });
 const binding=mountAtlasCpuDiagnosticsButton({
  root,controller,onRender:renderHtml
 });
 renderHtml(controller.render());
 return Object.freeze({
  controller,
  dispose:()=>binding.dispose()
 });
}
