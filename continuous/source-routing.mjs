export function researchQueries(question){
 const q=question.slice(0,200),plans=[q];
 if(/reddit|experiencia|comunidad|opiniones/i.test(q))plans.push(q+' site:reddit.com');
 if(/github|program|código|codigo|python|javascript|software|api|debug/i.test(q))plans.push(q+' (site:github.com OR site:developer.mozilla.org OR site:docs.python.org OR site:learn.microsoft.com)');
 if(/universidad|curso|investig|ciencia|acad[eé]mic/i.test(q))plans.push(q+' (site:ocw.mit.edu OR site:cs50.harvard.edu OR site:stanford.edu OR site:edu)');
 if(/estatal|gobierno|ley|legisl|estad[ií]stic|datos p[uú]blic/i.test(q))plans.push(q+' (site:boe.es OR site:ine.es OR site:datos.gob.es OR site:europa.eu)');
 if(/prensa|noticia|actualidad|hoy/i.test(q))plans.push(q+' (site:rtve.es OR site:reuters.com OR site:apnews.com)');
 return plans.slice(0,3);
}
export function sourceKind(url){
 const h=new URL(url).hostname;
 if(/(^|\.)reddit.com$/.test(h))return 'Comunidad: opiniones y experiencias por verificar';
 if(/(^|\.)github.com$/.test(h))return 'Repositorio: comprobar autor, versión, licencia y pruebas';
 if(/\.edu$|\.ac\.[a-z]+$/.test(h))return 'Institución académica: comprobar autor y fecha';
 if(/(^|\.)(boe.es|ine.es|datos.gob.es|europa.eu)$|\.gov$/.test(h))return 'Organismo público: comprobar ámbito y vigencia';
 return 'Fuente pública: comprobar autor, fecha y respaldo';
}
