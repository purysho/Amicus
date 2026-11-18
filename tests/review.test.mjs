import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as makeTCP} from 'node:net';
import {createServer as makeHTTP} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve(import.meta.dirname,'..');
function port(){return new Promise(resolve=>{const s=makeTCP();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function openApp(settings={}){const dir=await mkdtemp(join(tmpdir(),'amicus-review-'));const p=await port();const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(p),AMICUS_DB:join(dir,'db.sqlite'),AMICUS_MODEL:'',AMICUS_MODEL_BASE_URL:'',...settings},stdio:'ignore'});const base=`http://127.0.0.1:${p}`;let up=false;for(let i=0;i<70;i++){try{up=(await fetch(base+'/api/health')).ok;if(up)break;}catch{}await new Promise(r=>setTimeout(r,50));}if(!up)throw Error('server failed');return {base,async close(){child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}};}
async function post(base,path,body={}){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,result:await response.json()};}
const work='My client needs a specific account of what the employees observed and which risks were reasonably foreseeable. I will interview witnesses and check the platform evidence.';
test('offline review yields honest questions, records evidence, and avoids double-counting',async()=>{
 const app=await openApp();try{
  const none=await post(app.base,'/api/sim/review');assert.equal(none.status,400);
  let s=await (await fetch(app.base+'/api/state')).json();const baseline=JSON.stringify(s.state.mastery);
  const saved=await post(app.base,'/api/sim/work',{text:work});assert.equal(saved.status,200);
  const review=await post(app.base,'/api/sim/review');assert.equal(review.status,200);
  assert.equal(review.result.value.kind,'guided-checklist');assert.equal(review.result.state.practiceEvidence.length,1);
  assert.equal(JSON.stringify(review.result.state.mastery),baseline);
  const repeat=await post(app.base,'/api/sim/review');assert.equal(repeat.status,200);assert.equal(repeat.result.value.repeat,true);
  assert.equal(repeat.result.state.practiceEvidence.length,1);
  const next=await post(app.base,'/api/sim/advance');assert.equal(next.status,200);
  assert.equal(next.result.state.sim.stage,1);
  assert.equal(next.result.state.practiceEvidence.length,1);
 }finally{await app.close();}
});
test('model feedback uses disclosed IDs only and never promotes itself to mastery score',async()=>{
 const requests=[];const mock=makeHTTP(async(req,res)=>{let body='';for await(const part of req)body+=part;requests.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({headline:'Identify observed facts first',strengths:['A useful interview plan'],risks:['Which witness could verify the event sequence?'],question:'What precisely can your client independently recall?',factIds:['f1','f999']})}}]}));});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));const app=await openApp({AMICUS_MODEL:'mock-model',AMICUS_MODEL_BASE_URL:`http://127.0.0.1:${mock.address().port}/v1`});
 try{
  await post(app.base,'/api/sim/work',{text:work});
  const reviewed=await post(app.base,'/api/sim/review');assert.equal(reviewed.status,200);
  assert.equal(reviewed.result.value.kind,'model-feedback');assert.deepEqual(reviewed.result.value.factIds,['f1']);
  assert.match(reviewed.result.value.verification,/NOT been independently verified/);
  assert.equal(reviewed.result.state.practiceEvidence.length,1);
  assert.equal(reviewed.result.state.mastery.duty.total,5);
  assert.doesNotMatch(requests[0].messages[0].content,/The New York Court of Appeals reversed the judgment/);
  assert.match(requests[0].messages[0].content,/historical legal matter/);
 }finally{await app.close();mock.close();}
});

test('start-fresh erases locally persisted private audit history as well as documents and drafts',async()=>{
 const app=await openApp();try{
  await post(app.base,'/api/documents',{name:'private-notes.txt',base64:Buffer.from('Personal and private study data').toString('base64')});
  await post(app.base,'/api/drafts',{person:'Confidential Contact',occasion:'a private meeting',point:'research plans'});
  const before=await (await fetch(app.base+'/api/state')).json();assert.ok(before.audit.length>=2);
  const cleared=await post(app.base,'/api/reset',{demo:false});assert.equal(cleared.status,200);assert.equal(cleared.result.audit.length,0);assert.equal(cleared.result.documents.length,0);assert.equal(cleared.result.state.drafts.length,0);
  const exported=await post(app.base,'/api/export');assert.equal(exported.status,200);assert.deepEqual(exported.result.audit,[]);assert.deepEqual(exported.result.documents,[]);
 }finally{await app.close();}
});
