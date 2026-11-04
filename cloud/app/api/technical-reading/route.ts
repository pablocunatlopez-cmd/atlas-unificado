import {getTechnicalCatalog,getTechnicalReading} from '@/lib/research/technical-reading.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'public, max-age=300, s-maxage=1800','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id'),catalog=getTechnicalCatalog();
 if(id===null)return Response.json({catalog,maxDocuments:2,excerptLimit:1000},{headers});
 if(!catalog.some(item=>item.id===id))return Response.json({error:'Referencia no disponible.'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await getTechnicalReading(id,{signal:request.signal}),{headers});}
 catch{return Response.json({error:'La lectura no se completó.'},{status:request.signal.aborted?499:503,headers:{'Cache-Control':'no-store'}});}
}
