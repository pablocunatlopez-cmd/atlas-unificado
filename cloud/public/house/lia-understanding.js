import {LIA_IDENTITY} from './lia-identity.js';

/**
 * Evidence-aware, deterministic memory/answer contract for Lía.
 * No LLM inference, persistence, autonomous actions or assertions of truth.
 */
export function createLiaUnderstandingRecord({id,statement,source='unknown',evidence=[],observedAt=null}={}){
 if(typeof id!=='string'||!/^[a-z0-9-]{1,64}$/.test(id)||
    typeof statement!=='string'||!statement.trim()||statement.length>2000||
    !['memory','observation','unknown'].includes(source)||
    !Array.isArray(evidence)||evidence.length>12||
    evidence.some(item=>typeof item!=='string'||!item.trim()||item.length>512)||
    (observedAt!==null&&(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))))
  throw Error('Invalid Lía understanding record');
 // Classification describes evidence provenance, never automatic truth.
 const vertex=source==='memory'?'mental':source==='observation'?'physical':'event';
 const definition=LIA_IDENTITY.vertices.find(item=>item.id===vertex);
 const evidenceStatus=evidence.length===0?'unsubstantiated':'supplied_not_verified';
 return Object.freeze({id,statement:statement.trim(),vertex,
  component:definition.component,domain:definition.domain,
  provenance:source,evidence:Object.freeze([...evidence]),
  evidenceStatus,observedAt,truthVerified:false,
  unknownIsNotFalse:vertex==='event',requiresReview:true});
}

export function composeLiaUnderstanding({records=[]}={}){
 if(!Array.isArray(records)||records.length>100||
    records.some(r=>!r||typeof r.id!=='string'||
     !LIA_IDENTITY.vertices.some(v=>v.id===r.vertex)||
     typeof r.statement!=='string'||r.truthVerified!==false))
  throw Error('Invalid Lía records');
 if(new Set(records.map(r=>r.id)).size!==records.length)
  throw Error('Duplicate Lía record ID');
 const byVertex=Object.freeze(Object.fromEntries(LIA_IDENTITY.vertices.map(vertex=>
  [vertex.id,Object.freeze(records.filter(r=>r.vertex===vertex.id))])));
 return Object.freeze({identity:LIA_IDENTITY.name,byVertex,
  known:byVertex.mental.length,observed:byVertex.physical.length,
  unknown:byVertex.event.length,truthVerified:false,
  modelInferencePerformed:false,autonomousActionPerformed:false});
}
