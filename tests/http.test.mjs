import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
const root=resolve(import.meta.dirname,'..');
function freePort(){return new Promise((resolvePort,reject)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolvePort(port));});s.on('error',reject);});}
async function start(){const dir=await mkdtemp(join(tmpdir(),'amicus-test-'));const port=await freePort();const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),AMICUS_DB:join(dir,'test.db'),AMICUS_MODEL_BASE_URL:'',AMICUS_MODEL:'',AMICUS_MODEL_API_KEY:''},stdio:['ignore','pipe','pipe']});const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<45;i++){if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}}if(!ready){child.kill();await rm(dir,{recursive:true,force:true});throw Error('Server did not start');}return {base,async close(){child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}};}
async function post(base,path,body,headers={}){const response=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
test('HTTP: local-first golden path and guarded writes',async()=>{
 const svc=await start();const {base}=svc;
 try{
  const first=await (await fetch(base+'/api/state')).json();assert.equal(first.state.sim.stage,0);assert.equal(first.caseInfo.reveal,null);
  const assessment=await post(base,'/api/assess',{id:'transfer-1',answer:1});assert.equal(assessment.status,200);assert.equal(assessment.body.value.correct,true);
  const repeat=await post(base,'/api/assess',{id:'transfer-1',answer:1});assert.equal(repeat.body.value.repeat,true);
  const privacy=await post(base,'/api/onboard',{name:'Real Student',year:'2L',school:'Test School',city:'New Haven',interest:'Civil rights'});assert.equal(privacy.status,200);assert.equal(privacy.body.state.student.year,'2L');
  const turn=await post(base,'/api/sim/talk',{text:'What happened at the station?'});assert.equal(turn.status,200);assert.equal(turn.body.value.engine,'guided-demo');
  const blocked=await post(base,'/api/sim/advance',{});assert.equal(blocked.status,400);assert.match(blocked.body.error,/work product/);
  const work=await post(base,'/api/sim/work',{text:'I will investigate the scope of risk, determine the source of the injury, and test the strongest competing inference.'});assert.equal(work.status,200);
  const next=await post(base,'/api/sim/advance',{});assert.equal(next.status,200);assert.equal(next.body.state.sim.stage,1);
  const imported=await post(base,'/api/documents',{name:'notes.txt',base64:Buffer.from('Duty, breach, causation, damages.').toString('base64')});assert.equal(imported.status,200);assert.equal(imported.body.documents.length,1);
  const doc=await (await fetch(base+'/api/documents/'+imported.body.document.id)).json();assert.match(doc.body,/causation/);
  const draft=await post(base,'/api/drafts',{person:'Attorney Smith',occasion:'your public talk',point:'preparing effective questions'});assert.equal(draft.status,200);assert.equal(draft.body.value.status,'DRAFT — not sent');
  const csrf=await post(base,'/api/permissions',{capability:'email.send',value:'allow'},{origin:'https://attacker.example'});assert.equal(csrf.status,403);
  const content=await (await fetch(base+'/')).text();assert.match(content,/Amicus/);
 }finally{await svc.close();}
});
