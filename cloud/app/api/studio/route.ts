import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowedOrigin,privateHeaders} from '@/lib/server-state';
import {generateProject} from '@/lib/studio/generator';
import type {Brief,StudioMode} from '@/lib/studio/scene';
import {STUDIO_SQL} from '@/lib/studio/storage-sql';
import {researchPayload} from '@/lib/research/server';
export const dynamic='force-dynamic';
const schema=z.object({id:z.string().uuid().optional(),revision:z.number().int().min(1).optional(),prompt:z.string().trim().min(1).max(4000).optional(),mode:z.enum(['code','image','3d','game']).optional(),code:z.string().min(30).max(240000).optional(),seed:z.number().int().min(0).max(4294967295).optional(),quality:z.enum(['balanced','high']).optional(),lighting:z.enum(['day','sunset','night']).optional(),palette:z.enum(['Titanio','Oro','Azul','Rojo','Verde','Rosa','Blanco','Negro']).optional()});
type Row={id:string;user_id:string;title:string;mode:StudioMode;revision:number;created_at:string;updated_at:string};
type Version={version:number;content:string;created_at:string};
async function getProject(user:string,id:string,version?:number){
 if(!env.DB)throw new Error('DB');const p=await env.DB.prepare(STUDIO_SQL.project).bind(id,user).first<Row>();if(!p)return null;
 const v=await env.DB.prepare('SELECT version,content,created_at FROM studio_versions WHERE project_id=? AND version=?').bind(id,version||p.revision).first<Version>();if(!v)return null;
 const versions=await env.DB.prepare('SELECT version,created_at FROM studio_versions WHERE project_id=? ORDER BY version DESC').bind(id).all<{version:number;created_at:string}>();const content=JSON.parse(v.content) as{brief:Brief;code:string};
 return{id:p.id,title:content.brief.title,mode:content.brief.mode,prompt:content.brief.prompt,brief:content.brief,code:content.code,revision:p.revision,viewingVersion:v.version,createdAt:p.created_at,updatedAt:p.updated_at,versions:versions.results.map(v=>({version:v.version,date:v.created_at}))};
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para abrir tus proyectos.'},{status:401,headers:privateHeaders});if(!env.DB)return Response.json({error:'Los proyectos no están disponibles.'},{status:503,headers:privateHeaders});
 try{const url=new URL(request.url),id=url.searchParams.get('id');if(id){if(!z.string().uuid().safeParse(id).success)return Response.json({error:'Proyecto no válido.'},{status:400,headers:privateHeaders});const raw=url.searchParams.get('version'),version=raw?Number(raw):undefined;if(version!==undefined&&(!Number.isSafeInteger(version)||version<1))return Response.json({error:'Versión no válida.'},{status:400,headers:privateHeaders});const project=await getProject(user.userId,id,version);return project?Response.json({project},{headers:privateHeaders}):Response.json({error:'Proyecto no encontrado.'},{status:404,headers:privateHeaders});}
  const rows=await env.DB.prepare('SELECT id,title,mode,revision,updated_at FROM studio_projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 60').bind(user.userId).all();return Response.json({projects:rows.results.map((r:Record<string,unknown>)=>({...r,updatedAt:r.updated_at}))},{headers:privateHeaders});
 }catch{return Response.json({error:'No se pudieron abrir los proyectos.'},{status:503,headers:privateHeaders});}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Inicia sesión para guardar tu creación.'},{status:401,headers:privateHeaders});if(!allowedOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403,headers:privateHeaders});if(!env.DB)return Response.json({error:'Los proyectos no están disponibles.'},{status:503,headers:privateHeaders});
 try{
  const raw=await request.text();if(raw.length>300000)return Response.json({error:'El proyecto supera el tamaño admitido.'},{status:413,headers:privateHeaders});const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'El proyecto no pasa la validación.'},{status:400,headers:privateHeaders});const input=parsed.data;
  let brief:Brief,code:string;const existing=input.id?await getProject(user.userId,input.id):null;
  if(input.id&&(!existing||input.revision!==existing.revision))return Response.json({error:'El proyecto cambió en otro lugar. Recárgalo antes de guardar.'},{status:409,headers:privateHeaders});
  if(input.code!==undefined){if(!existing)return Response.json({error:'Abre un proyecto antes de guardar código.'},{status:400,headers:privateHeaders});brief=existing.brief;code=input.code;}
  else{if(!input.prompt||!input.mode)return Response.json({error:'Describe qué quieres crear y elige un modo.'},{status:400,headers:privateHeaders});const profiles=(await researchPayload()).control.spiral?.profiles;const generated=generateProject(input.prompt,input.mode,{meshRows:profiles?.meshRows,seed:input.seed,quality:input.quality,lighting:input.lighting,palette:input.palette});brief=generated.brief;code=generated.code;}
  const id=existing?.id||crypto.randomUUID(),revision=(existing?.revision||0)+1,date=new Date().toISOString(),content=JSON.stringify({brief,code});
  if(existing){const results=await env.DB.batch([
   env.DB.prepare(STUDIO_SQL.appendVersion).bind(crypto.randomUUID(),revision,content,date,id,user.userId,input.revision),
   env.DB.prepare(STUDIO_SQL.updateProject).bind(brief.title,brief.mode,revision,date,id,user.userId,input.revision)
  ]);if(!results[1].meta.changes)return Response.json({error:'Hay una versión más reciente. Tus cambios siguen en el editor.'},{status:409,headers:privateHeaders});}
  else await env.DB.batch([env.DB.prepare('INSERT INTO studio_projects (id,user_id,title,mode,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,user.userId,brief.title,brief.mode,1,date,date),env.DB.prepare('INSERT INTO studio_versions (id,project_id,version,content,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),id,1,content,date)]);
  return Response.json({project:await getProject(user.userId,id)},{headers:privateHeaders});
 }catch{return Response.json({error:'No se completó la creación o el guardado. La versión anterior sigue disponible.'},{status:503,headers:privateHeaders});}
}
