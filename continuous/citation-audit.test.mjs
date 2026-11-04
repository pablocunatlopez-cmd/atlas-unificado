import test from 'node:test';
import assert from 'node:assert/strict';
import {labelCitationSources,auditCitations,citationInstructions} from './citation-audit.mjs';

test('source labels are allocated by the coordinator and unsafe URLs cannot become citations',()=>{
 const sources=labelCitationSources([{url:'https://example.org/doc',citationLabel:'F999'},{url:'javascript:alert(1)'},{url:'http://127.0.0.1/private'}]);
 assert.deepEqual(sources.map(source=>source.citationLabel),['F1']);
 assert.equal(sources[0].citationUrl,'https://example.org/doc');
 assert.match(citationInstructions(sources),/no verdad/);
});
test('web metadata cannot leak credential URLs or substitute a different citation target',()=>{
 const sources=labelCitationSources([{url:'https://example.org/doc?token=secret',excerpt:'unsafe'},{url:'https://example.org/read?id=1',citation:{url:'https://other.org/never-read?token=secret'},privateMetadata:'secret',requestedUrl:'https://example.org/doc?api_key=secret',excerpt:'read'}]);
 assert.equal(sources.length,1);assert.equal(sources[0].citationUrl,'https://example.org/read?id=1');assert.equal(sources[0].citation.url,sources[0].url);assert.doesNotMatch(JSON.stringify(sources),/secret|never-read|privateMetadata/);
});
test('identity checks distinguish missing labels, matching links and links that were not read',()=>{
 const sources=labelCitationSources([{url:'https://example.org/doc'}]);
 const report=auditCitations('Dato [F1]. Error [F7]. [Origen](https://example.org/doc) y [Recurso](https://example.net/tool)',sources);
 assert.equal(report.status,'unknown-references');assert.deepEqual(report.referencedLabels,['F1']);assert.deepEqual(report.unknownLabels,['F7']);
 assert.equal(report.providedSourceLinks,1);assert.equal(report.otherLinks,1);assert.equal(report.semanticSupportVerified,false);assert.equal(report.sourceTruthVerified,false);
});
test('code examples are not interpreted as citations and uncited answers remain unverified',()=>{
 assert.equal(auditCitations('```\narray[F99]\n``` y `x[F4]`',[]).status,'unattributed');
 assert.equal(auditCitations('Respuesta sin fuentes.',[]).semanticSupportVerified,false);
});
