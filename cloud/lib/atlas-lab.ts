import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { atlasLab } from '@/db/schema';
import { documents } from './archive';
import { chunkKnowledge, type Knowledge } from './atlas-core';
import native from '@/data/native-principles.json';
import seed from '@/data/atlas-lm-seed.json';
import { validateSnapshot } from '@/public/core/language-model.mjs';
import type { LabState } from './lab-types';
import {learningSchema} from './atlas-spiral';
const finite = z.number().finite();
const metrics = z.object({ before: finite.min(0).max(100), after: finite.min(0).max(100), trainCharacters: z.number().int().min(0).max(1000000), validationCharacters: z.number().int().min(0).max(1000000), elapsedMs: finite.min(0).max(86400000), attemptedSteps: z.number().int().min(0).max(100000000), improved: z.boolean(), trainLoss: finite.optional() });
const snapshot = z.custom<LabState['checkpoint']>(validateSnapshot, 'Checkpoint incompatible o inválido');
export const labSchema = z.object({
 documents: z.array(z.object({ id: z.string().max(100), title: z.string().min(1).max(180), text: z.string().min(40).max(16000), date: z.string().max(50), url: z.string().max(2000).refine(s => s === '' || /^https?:\/\//.test(s), 'URL no válida') })).max(16),
 checkpoint: snapshot, previous: snapshot.optional(),
 training: z.array(z.object({ id: z.string().max(100), date: z.string().max(50), corpusHash: z.string().max(100), metrics, status: z.enum(['Promovido','Descartado','Inicial','Restaurado']) })).max(40),
 missions: z.array(z.object({ id: z.string().max(100), goal: z.string().max(8000), date: z.string().max(50), steps: z.array(z.object({ tool: z.string().max(100), result: z.string().max(10000), date: z.string().max(50), status: z.enum(['ok','limitado']) })).max(12), summary: z.string().max(20000), gaps: z.array(z.string().max(2000)).max(10), status: z.enum(['Resuelta','Parcial']) })).max(30),
 learning:learningSchema.optional()
});
const initialLab = (): LabState => ({ documents: [], checkpoint: seed.snapshot, training: [{ id: 'seed-lm-01', date: seed.provenance.trainedAt, corpusHash: seed.provenance.corpusSha256, metrics: seed.metrics, status: 'Inicial' }], missions: [] });
export async function readLab(userId: string): Promise<{ lab: LabState; revision: number }> {
 const db=getDb();let rows=await db.select().from(atlasLab).where(eq(atlasLab.userId,userId)).limit(1);
 if(!rows.length){await db.insert(atlasLab).values({userId,revision:0,content:JSON.stringify(initialLab()),updatedAt:new Date().toISOString()}).onConflictDoNothing();rows=await db.select().from(atlasLab).where(eq(atlasLab.userId,userId)).limit(1);}
 return {lab:JSON.parse(rows[0].content) as LabState,revision:rows[0].revision};
}
export async function saveLab(userId: string, lab: LabState, revision: number) {
 const valid=labSchema.parse(lab);const rows=await getDb().update(atlasLab).set({content:JSON.stringify(valid),revision:revision+1,updatedAt:new Date().toISOString()}).where(and(eq(atlasLab.userId,userId),eq(atlasLab.revision,revision))).returning({revision:atlasLab.revision});
 if(!rows.length)throw new Error('CONFLICT');return rows[0].revision;
}
let archived: Knowledge[] | null=null;
export function getKnowledge(lab: LabState): Knowledge[] {
 archived??=chunkKnowledge([...native, ...documents.map(d=>({...d,kind:'Archivo histórico',url:'/api/archive?id='+encodeURIComponent(d.id)}))]);
 return [...(lab.learning?.observations||[]).map(o=>({id:o.id,title:o.title,text:o.text,kind:o.label+' · Espiral Atlas',date:o.date,url:o.url})),...lab.documents.map(d=>({...d,kind:'Documento aportado',url:d.url||'#corpus'})),...archived];
}
export function seedCorpus() { return [...native.map(d=>d.text),...documents.filter(d=>d.id!=='atlas-core').map(d=>d.text.slice(0,12000))].join('\n\n').slice(0,100000); }
