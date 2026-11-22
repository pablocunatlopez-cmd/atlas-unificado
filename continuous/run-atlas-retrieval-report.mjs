import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRetrievalLab} from './retrieval-lab.mjs';
import {compareRetrievalLabStrategies} from './atlas-retrieval-lab-comparison.mjs';
import {buildAtlasRetrievalReport} from './atlas-retrieval-report.mjs';

/** Offline CLI. Only caller-supplied JSON; no canonical memory or model access.
 * Usage: node continuous/run-atlas-retrieval-report.mjs <fixture.json> <output-directory>
 * Fixture: {documents:[{id,title,text}],cases:[{id,question,relevantIds}],
 * citationLabels:{[caseId]:{'atlas-lexical':boolean,fts5:boolean}}}
 * Output only contains report metrics and hashed case IDs, never source texts.
 */
export async function runAtlasRetrievalReport(fixture,{minimumQueries=100,warmupRounds=1,measurementRounds=5}={}){
 if(!fixture||typeof fixture!=='object'||Array.isArray(fixture)||
  !Array.isArray(fixture.documents)||!Array.isArray(fixture.cases)||
  !fixture.citationLabels||typeof fixture.citationLabels!=='object')
  throw new TypeError('Invalid retrieval fixture');
 const lab=createRetrievalLab(fixture.documents);
 try{
  const result=compareRetrievalLabStrategies(lab,fixture.cases,{
   citationLabels:fixture.citationLabels,minimumQueries,warmupRounds,measurementRounds
  });
  return buildAtlasRetrievalReport(result,{
   baselineVersion:'atlas-lexical',candidateVersion:'fts5'
  });
 }finally{lab.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const args=process.argv.slice(2);
 if(args.length!==2)throw new Error('Usage: node run-atlas-retrieval-report.mjs <fixture.json> <output-directory>');
 const [input,output]=args.map(resolve);
 const stat=await import('node:fs/promises').then(fs=>fs.stat(input));
 if(!stat.isFile()||stat.size>3*1024*1024)throw new Error('Fixture must be a JSON file <= 3 MB');
 const fixture=JSON.parse(await readFile(input,'utf8'));
 const report=await runAtlasRetrievalReport(fixture);
 await mkdir(output,{recursive:true});
 const destination=join(output,'atlas-retrieval-'+report.reportHash.slice(7)+'.json');
 await writeFile(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({reportFile:destination,verdict:report.gate.verdict,recommendation:report.recommendation,reportHash:report.reportHash}));
}
