import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createServer} from 'node:net';
import {passages, ftsQuery, isRetrospectivePalsgrafMaterial} from '../server/retrieval.mjs';

const root = resolve(import.meta.dirname,'..');
function freePort(){return new Promise((resolve,reject)=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});server.on('error',reject);});}
async function start(){const directory=await mkdtemp(join(tmpdir(),'amicus-rag-'));const port=await freePort();const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),AMICUS_DB:join(directory,'amicus.db'),AMICUS_MODEL:'',AMICUS_MODEL_BASE_URL:''},stdio:'ignore'});const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<70;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}if(!ready){child.kill();throw new Error('Server failed to start');}return {base,child,directory,async close(){child.kill();await new Promise(r=>child.once('exit',r));await rm(directory,{recursive:true,force:true});}};}
async function post(base,url,payload){const response=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,data:await response.json()};}

test('passages retain PDF page boundaries and stable ordinal locators',()=>{
 const chunks=passages('Duty can be context-dependent.\fForeseeability is not identical to cause in fact.');
 assert.equal(chunks.length,2);
 assert.deepEqual(chunks.map(x=>x.page),[1,2]);
 assert.deepEqual(chunks.map(x=>x.chunkIndex),[0,1]);
});
test('query syntax is inert data, not FTS5 operators',()=>{
 assert.equal(ftsQuery('" OR NOT CourtListener * duty'), '"courtlistener" OR "duty"');
 assert.equal(ftsQuery('the and would'), '');
});
test('retrospective casebook identification is deterministic',()=>{assert.equal(isRetrospectivePalsgrafMaterial('Cardozo considers Palsgraf'),true);assert.equal(isRetrospectivePalsgrafMaterial('Contract formation and consideration'),false);});
test('uploaded academic sources can be searched with explicit local citations and permissions',async()=>{
 const app=await start();try{
  const body='Consideration is a bargained-for exchange.\n\nA negligence claim depends on duty and breach, not simply injury.\n\nThe professor asks us to identify the risk and articulate a limiting principle.';
  const imported=await post(app.base,'/api/documents',{name:'torts-outline.txt',base64:Buffer.from(body).toString('base64')});
  assert.equal(imported.status,200);
  const hits=await post(app.base,'/api/research/search',{query:'What did professor say about limiting principle?'});
  assert.equal(hits.status,200);assert.ok(hits.data.hits.length>=1);
  assert.equal(hits.data.hits[0].name,'torts-outline.txt');
  assert.match(hits.data.hits[0].locator,/passage/);
  assert.match(hits.data.hits[0].excerpt,/professor/);
  const tutor=await post(app.base,'/api/tutor/talk',{text:'Explain the professor limiting principle',mode:'socratic'});
  assert.equal(tutor.status,200);
  assert.ok(tutor.data.citations.some(x=>x.name==='torts-outline.txt'));
  assert.match(tutor.data.result.text,/Found in your uploaded materials/);
  const dangerous=await post(app.base,'/api/documents',{name:'torts-palsgraf-opinion.txt',base64:Buffer.from('Cardozo discussion of proximate cause in Palsgraf.').toString('base64')});
  assert.equal(dangerous.status,200);
  const quarantined=await post(app.base,'/api/research/search',{query:'Cardozo discussion'});
  assert.equal(quarantined.status,200);assert.deepEqual(quarantined.data.hits,[]);assert.equal(quarantined.data.historicalVeil,true);
  const safeTutor=await post(app.base,'/api/tutor/talk',{text:'Cardozo discussion',mode:'explain'});
  assert.equal(safeTutor.status,200);assert.deepEqual(safeTutor.data.citations,[]);
  const empty=await post(app.base,'/api/research/search',{query:'quantum entanglement'});
  assert.equal(empty.status,200);assert.equal(empty.data.hits.length,0);
  const denied=await post(app.base,'/api/permissions',{capability:'documents.read',value:'deny'});
  assert.equal(denied.status,200);
  const deniedSearch=await post(app.base,'/api/research/search',{query:'limiting principle'});
  assert.equal(deniedSearch.status,403);
  const deniedTutor=await post(app.base,'/api/tutor/talk',{text:'limiting principle',mode:'explain'});
  assert.equal(deniedTutor.status,200);assert.deepEqual(deniedTutor.data.citations,[]);
  await post(app.base,'/api/reset',{demo:true});
  await post(app.base,'/api/permissions',{capability:'documents.read',value:'allow'});
  const deleted=await post(app.base,'/api/research/search',{query:'limiting principle'});
  assert.deepEqual(deleted.data.hits,[]);
 }finally{await app.close();}
});
