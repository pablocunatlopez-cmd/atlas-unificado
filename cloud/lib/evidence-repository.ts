import {parseEvidenceRecord,type EvidenceRecord} from './evidence-contract.ts';
/** Durable reported evidence. Persistence does not independently verify tests. */
export function createEvidenceRepository(db:D1Database){
 async function init(){await db.prepare('CREATE TABLE IF NOT EXISTS typed_evidence (artifact_id TEXT PRIMARY KEY,completed_ms INTEGER NOT NULL,content TEXT NOT NULL)').run();}
 return{
  async list(){await init();const rows=await db.prepare('SELECT content FROM typed_evidence ORDER BY completed_ms DESC,artifact_id LIMIT 32').all<{content:string}>();return rows.results.flatMap(row=>{try{const value=parseEvidenceRecord(JSON.parse(row.content));return value?[value]:[];}catch{return [];}});},
  async remember(raw:unknown){const checked=parseEvidenceRecord(raw);if(!checked)throw Error('INVALID_EVIDENCE');await init();const record:EvidenceRecord={...checked,completedAt:new Date(checked.completedAt).toISOString()};await db.prepare(`INSERT INTO typed_evidence(artifact_id,completed_ms,content) VALUES(?,?,?) ON CONFLICT(artifact_id) DO UPDATE SET completed_ms=excluded.completed_ms,content=excluded.content WHERE excluded.completed_ms>typed_evidence.completed_ms OR (excluded.completed_ms=typed_evidence.completed_ms AND json_extract(typed_evidence.content,'$.integratedRevision') IS NULL AND json_extract(excluded.content,'$.integratedRevision') IS NOT NULL)`).bind(record.artifactId,Date.parse(record.completedAt),JSON.stringify(record)).run();await db.prepare('DELETE FROM typed_evidence WHERE artifact_id NOT IN (SELECT artifact_id FROM typed_evidence ORDER BY completed_ms DESC,artifact_id LIMIT 512)').run();return record;}
 };
}
