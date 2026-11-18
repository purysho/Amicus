import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
const root=resolve(import.meta.dirname,'..');
async function port(){return new Promise(r=>{const server=createServer();server.listen(0,'127.0.0.1',()=>server.close(()=>r(server.address()?.port)));});}
async function start(){const dir=await mkdtemp(join(tmpdir(),'amicus-career-'));const p=await new Promise((resolvePort,reject)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolvePort(n));});s.on('error',reject);});
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(p),AMICUS_DB:join(dir,'data.db'),AMICUS_GOOGLE_TOKEN_FILE:join(dir,'tokens.enc'),AMICUS_VAULT_KEY_FILE:join(dir,'vault.key'),AMICUS_GOOGLE_CLIENT_ID:'',AMICUS_GOOGLE_CLIENT_SECRET:'',AMICUS_MODEL_BASE_URL:'',AMICUS_MODEL:''},stdio:'ignore'});const base=`http://127.0.0.1:${p}`;let alive=false;for(let i=0;i<70;i++){try{alive=(await fetch(base+'/api/health')).ok;if(alive)break;}catch{}await new Promise(r=>setTimeout(r,60));}if(!alive)throw Error('App failed to start');return {base,async close(){child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}};
}
async function post(base,path,data){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {code:r.status,data:await r.json()};}
const feed='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:career-123\nSUMMARY:Career panel in New Haven\nDTSTART:20270109T140000Z\nDTEND:20270109T150000Z\nLOCATION:New Haven\nURL:https://example.edu/event/123\nEND:VEVENT\nEND:VCALENDAR';
test('HTTP career loop: real imported events, contacts, tasks and drafts are persisted; outbound actions are gated',async()=>{
 const app=await start();try{
  let response=await post(app.base,'/api/events/import',{name:'school-events.ics',base64:Buffer.from(feed).toString('base64')});assert.equal(response.code,200);assert.equal(response.data.value.imported,1);
  const evt=response.data.state.events[0];assert.equal(evt.status,'discovered');assert.notEqual(evt.status,'registered');
  response=await post(app.base,'/api/events/ics',{id:evt.id});assert.equal(response.code,200);assert.match(response.data.content,/BEGIN:VCALENDAR/);
  response=await post(app.base,'/api/events/save',{id:evt.id,saved:true});assert.equal(response.data.value.saved,true);
  response=await post(app.base,'/api/contacts',{name:'Attendee Example',email:'person@example.edu',relationship:'not-met'});assert.equal(response.code,200);const cid=response.data.value.id;
  response=await post(app.base,'/api/contacts/interaction',{id:cid,kind:'introduction',note:'A colleague introduced us at an event'});assert.equal(response.code,200);assert.equal(response.data.value.interactions.length,1);
  response=await post(app.base,'/api/tasks',{title:'Prepare for career panel',kind:'career',due:'2027-01-05'});assert.equal(response.code,200);const tid=response.data.value.id;
  response=await post(app.base,'/api/tasks/complete',{id:tid,done:true});assert.equal(response.code,200);assert.equal(response.data.value.done,true);
  response=await post(app.base,'/api/drafts',{person:'Attendee Example',to:'person@example.edu',occasion:'the career panel',point:'our conversation about research skills'});assert.equal(response.code,200);const did=response.data.value.id;
  const blockedGmail=await post(app.base,'/api/google/gmail/draft',{id:did,confirm:'CREATE GMAIL DRAFT'});assert.equal(blockedGmail.code,403);
  const blockedCal=await post(app.base,'/api/google/calendar/create',{id:evt.id,confirm:'CREATE CALENDAR EVENT'});assert.equal(blockedCal.code,403);
  const blockedPeople=await post(app.base,'/api/speakers/research',{name:'Judge Jane Doe'});assert.equal(blockedPeople.code,403);
  const blockedSend=await post(app.base,'/api/google/gmail/send',{id:did,confirm:'SEND EMAIL'});assert.equal(blockedSend.code,403);
  const after=await (await fetch(app.base+'/api/state')).json();assert.equal(after.state.contacts.length,1);assert.equal(after.state.tasks[0].done,true);assert.equal(after.state.events[0].status,'discovered');
  const reset=await post(app.base,'/api/reset',{demo:false});assert.equal(reset.code,200);assert.deepEqual(reset.data.state.events,[]);assert.deepEqual(reset.data.state.contacts,[]);assert.deepEqual(reset.data.state.tasks,[]);
 }finally{await app.close();}
});
