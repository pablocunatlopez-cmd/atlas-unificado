/**
 * Portable, framework-independent voice controls markup. Rendering is
 * delegated to a trusted UI host; all labels are escaped.
 */
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
export function renderAtlasVoiceControls({phase='idle',transcript=''}={}){
 if(!['idle','recording','review','submitting','answered','error'].includes(phase)||
  typeof transcript!=='string'||transcript.length>8000)
  throw Error('Invalid voice controls state');
 const buttons={
  idle:'<button type="button" data-action="voice-start">Grabar voz</button>',
  recording:'<button type="button" data-action="voice-stop">Detener grabación</button>',
  review:'<button type="button" data-action="voice-confirm">Confirmar texto</button><button type="button" data-action="voice-reset">Descartar</button>',
  submitting:'<button type="button" disabled>Procesando</button>',
  answered:'<button type="button" data-action="voice-reset">Nueva consulta</button>',
  error:'<button type="button" data-action="voice-reset">Reintentar</button>'
 };
 return '<section aria-label="Controles de voz de Atlas">'+
  '<p role="status">'+escapeHtml(phase)+'</p>'+
  (phase==='review'?'<p data-role="transcript">'+escapeHtml(transcript)+'</p>':'')+
  buttons[phase]+'</section>';
}
