import {extractText} from './engine.mjs';

export function googleBlockReason(html,url='https://www.google.com/search'){
 const u=new URL(url),body=String(html);
 if(u.hostname==='consent.google.com'||/before you continue to google|antes de (?:ir|continuar) a google/i.test(body))return 'Google requiere consentimiento en el navegador.';
 if(u.pathname.startsWith('/sorry')||/unusual traffic|tr[aá]fico inusual|g-recaptcha|recaptcha\/api|detected automated queries/i.test(body))return 'Google ha bloqueado la consulta automática o solicita CAPTCHA.';
 if(/enable javascript|habilita javascript|enablejs/i.test(body)&&!/<h3\b/i.test(body))return 'Google requiere JavaScript para mostrar los resultados.';
 return null;
}

export function parseGoogleResults(html,validateUrl,limit=4){
 const results=[],seen=new Set();
 for(const match of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const heading=match[2].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
  const href=match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if(!heading||!href)continue;
  try{
   const link=new URL((href[1]||href[2]).replace(/&amp;/g,'&'),'https://www.google.com');
   const isGoogle=link.hostname==='www.google.com'||link.hostname==='google.com';
   const destination=isGoogle&&link.pathname==='/url'?(link.searchParams.get('q')||link.searchParams.get('url')):link.href;
   const u=validateUrl(destination);
   if(['www.google.com','google.com','consent.google.com','accounts.google.com'].includes(u.hostname)||seen.has(u.href))continue;
   const title=extractText(heading[1]).slice(0,300);if(!title)continue;
   seen.add(u.href);results.push({url:u.href,title,excerpt:title,fetchedAt:new Date().toISOString(),method:'Resultado Google; título del índice, página de destino no leída'});
   if(results.length>=limit)break;
  }catch{}
 }
 return results;
}

export function createGoogleSearch(get,validateUrl,now=Date.now){
 let retryAt=0,last={status:'not-tested',reason:null,at:null};
 return {
  status:()=>({...last,retryAt:retryAt?new Date(retryAt).toISOString():null}),
  async search(query,signal){
   signal?.throwIfAborted();
   if(now()<retryAt)return {sources:[],errors:[last.reason+' Se mantiene la alternativa pública hasta el próximo intento.']};
   try{
    const result=await get('https://www.google.com/search?q='+encodeURIComponent(query.slice(0,200))+'&hl=es&num=4',signal);
    const blocked=googleBlockReason(result.text,result.url);
    if(blocked){last={status:'blocked',reason:blocked,at:new Date(now()).toISOString()};retryAt=now()+30*60000;return {sources:[],errors:[blocked+' No se ha resuelto ni eludido el bloqueo.']};}
    const sources=parseGoogleResults(result.text,validateUrl);
    if(!sources.length)throw Error('Google no entregó resultados que el lector pueda interpretar.');
    last={status:'available',reason:null,at:new Date(now()).toISOString()};retryAt=0;return {sources,errors:[]};
   }catch(error){signal?.throwIfAborted();last={status:'unavailable',reason:error.message,at:new Date(now()).toISOString()};retryAt=now()+5*60000;return {sources:[],errors:['Google: '+error.message]};}
  }
 };
}
