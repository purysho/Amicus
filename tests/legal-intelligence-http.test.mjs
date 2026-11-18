import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
const root=resolve(import.meta.dirname,'..');
const pickPort=()=>new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>r(port));});});
async function start(){
 const temp=await mkdtemp(join(tmpdir(),'amicus-legal-'));const port=await pickPort();
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),AMICUS_DB:join(temp,'test.sqlite'),AMICUS_MODEL_BASE_URL:'',AMICUS_MODEL:'',COURTLISTENER_API_TOKEN:'',AMICUS_GOOGLE_CLIENT_ID:'',AMICUS_GOOGLE_CLIENT_SECRET:''},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
 if(!ready)throw new Error('Server did not start');
 return {base,async close(){child.kill();await new Promise(r=>child.once('exit',r));await rm(temp,{recursive:true,force:true});}};
}
async function post(base,route,payload){const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,body:await response.json()};}
test('legal intelligence HTTP golden-path preserves veil, privacy and evidentiary uncertainty',async()=>{
 const app=await start();try{
  const state=await (await fetch(app.base+'/api/state')).json();
  assert.equal(state.primaryRecord.extracts.length,0);
  assert.equal(state.competencies.find(x=>x.skill==='duty').measuredPercent,null);
  assert.equal(state.assessments.find(x=>x.id==='transfer-1').correct,undefined);
  let x=await post(app.base,'/api/legal/verify',{claim:'Cardozo held no duty',citation:'248 N.Y. 339'});
  assert.equal(x.status,200);assert.equal(x.body.result.citationStatus,'historically-sealed');
  x=await post(app.base,'/api/legal/verify',{claim:'Cardozo held no duty',citation:'248 N.Y. 339',external:true});
  assert.equal(x.status,403);
  x=await post(app.base,'/api/record/search',{query:'dissent'});assert.equal(x.status,200);assert.equal(x.body.pages.length,0);
  x=await post(app.base,'/api/record/import',{base64:Buffer.from('%PDF-not real').toString('base64')});assert.equal(x.status,403);
  x=await post(app.base,'/api/competency/reasoning',{id:'novel-shop-negligence',selfConfidence:3,text:'First I would identify the risk that made the obstruction negligent, then establish factual cause before considering which foreseeable class of harms and plaintiffs the duty protects. A voluntary chase may break or narrow scope.'});
  assert.equal(x.status,200);assert.equal(x.body.value.grading.startsWith('ungraded'),true);
  let again=await post(app.base,'/api/competency/reasoning',{id:'novel-shop-negligence',selfConfidence:3,text:'Repeat '.repeat(30)});
  assert.equal(again.status,200);assert.equal(again.body.value.repeat,true);
  const after=await (await fetch(app.base+'/api/state')).json();
  assert.equal(after.state.reasoningEvidence.length,1);
  assert.equal(after.competencies.find(x=>x.skill==='proximate-cause').measuredPercent,null);
  assert.equal(after.realism.humanNaturalness,null);
  const reset=await post(app.base,'/api/reset',{demo:false});assert.equal(reset.status,200);
  assert.deepEqual(reset.body.state.reasoningEvidence,[]);
 } finally {await app.close();}
});
