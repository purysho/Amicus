import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {CASE, ASSESSMENTS,initialState,assess,visibleFacts,visibleSources,advance,submitWork,roleSwitch,evidenceAudit,appendActivity,publicAssessments} from './engine.mjs';
import {readState,saveState,resetState,listDocs,getDoc,addDoc,searchDocuments,audit,latestAudit,allAudit,storePrimaryRecord,readPrimaryRecord} from './db.mjs';
import {simulationResponse,tutoringResponse,reviewSimulationWork,modelStatus} from './ai.mjs';
import {PUBLIC_FEEDS,SOURCE_DIRECTORIES,parseICalendar,rankOpportunity,careerPlan,createContact,addInteraction,createTask,createMintoDraft,eventToICS,legalUrl} from './career.mjs';
import {googleStatus,beginGoogle,completeGoogle,disconnectGoogle,clearGoogleVault,createGmailDraft,sendGmailDraft,listCalendar,createCalendarEvent,fetchPublicFeed} from './integrations.mjs';
import {searchSpeaker} from './speakers.mjs';
import {PRIMARY_RECORD,recordExtracts,ocrRecord,searchableRecordPages} from './historical.mjs';
import {localVerify,courtListenerLookup} from './verification.mjs';
import {TRANSFER_EXERCISES,storeReasoning,competencyReport} from './competency.mjs';
import {RUBRIC,evaluateTranscript,recordHumanRating} from './realism.mjs';
if(existsSync('.env')){try{process.loadEnvFile('.env');}catch(e){console.warn('Could not read .env:',e.message);}}
const port=Number(process.env.PORT||4173);const root=resolve('public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const outboundInFlight=new Set();
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function json(res,value,status=200){const data=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
async function readBody(req,limit=12*1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new ApiError(413,'Request too large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new ApiError(400,'Invalid JSON');}}
function stateView(){const state=readState();return {state,career:{sources:SOURCE_DIRECTORIES,liveFeeds:PUBLIC_FEEDS,plan:careerPlan(state.student,state.contacts,state.events,state.tasks),ranked:state.events.map(e=>({id:e.id,...rankOpportunity(e,state.student)})).sort((a,b)=>b.score-a.score),google:googleStatus()},caseInfo:{title:CASE.title,citation:CASE.citation,stages:CASE.history,stage:CASE.history[state.sim.stage],facts:visibleFacts(state.sim),sources:visibleSources(state.sim),reveal:state.sim.stage===5?CASE.reveal:null},assessments:publicAssessments(state),transferExercises:TRANSFER_EXERCISES,competencies:competencyReport(state),primaryRecord:{title:PRIMARY_RECORD.title,url:PRIMARY_RECORD.sourceUrl,guideUrl:PRIMARY_RECORD.guideUrl,extracts:recordExtracts(state.sim.stage),imported:!!readPrimaryRecord(),pageCount:readPrimaryRecord()?.count||0,importedAt:readPrimaryRecord()?.importedAt||null},realism:{rubric:RUBRIC,...evaluateTranscript(state.sim.transcript,visibleFacts(state.sim).map(f=>f.id))},documents:listDocs(),model:modelStatus(),evidence:evidenceAudit(state),audit:latestAudit()};}
const requireString=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new ApiError(400,`Expected text (1–${max} characters)`);return v.trim();};
function ensureCapability(state,capability){if(state.permissions[capability]!=='allow')throw new ApiError(403,`${capability} requires permission. Open Data & controls and change it to ALLOW.`);}
function mutate(kind,payload,fn){const state=readState();const value=fn(state);appendActivity(state,kind,typeof payload==='string'?payload:JSON.stringify(payload).slice(0,150));saveState(state);audit(kind,payload);return {value,...stateView()};}
async function ingest(body){
 const name=requireString(body.name,180);if(!/\.(txt|md|pdf)$/i.test(name))throw new ApiError(415,'Upload .txt, .md or .pdf');
 if(typeof body.base64!=='string'||body.base64.length>14*1024*1024)throw new ApiError(413,'File too large');
 const bytes=Buffer.from(body.base64,'base64');if(bytes.length>10*1024*1024)throw new ApiError(413,'10MB file limit');
 let content='';let type='text';
 if(name.toLowerCase().endsWith('.pdf')){
  if(bytes.subarray(0,4).toString()!=='%PDF')throw new ApiError(415,'Invalid PDF file');
  const temp=await mkdtemp(join(tmpdir(),'amicus-'));const path=join(temp,'upload.pdf');
  try{await writeFile(path,bytes);const result=spawnSync('pdftotext',['-layout',path,'-'],{encoding:'utf8',timeout:18000,maxBuffer:20*1024*1024});if(result.error||result.status!==0)throw new ApiError(422,'PDF extraction requires Poppler pdftotext installed on this computer. Upload .txt/.md instead, or install Poppler.');content=result.stdout;type='pdf-extracted-text';}finally{await rm(temp,{recursive:true,force:true}).catch(()=>{});}
 }else{content=bytes.toString('utf8');}
 content=content.replace(/\u0000/g,'').trim();if(!content)throw new ApiError(422,'No extractable text detected (scanned PDFs need OCR)');
 if(content.length>12000000)throw new ApiError(413,'Extracted text exceeds 12 million characters. Split the textbook into smaller volumes.');
 const doc={id:`doc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,type,body:content};
 addDoc(doc);audit('document.upload',{id:doc.id,name,type,length:doc.body.length});return {document:{id:doc.id,name,type,size:doc.body.length},...stateView()};
}
function draftEmail(body){const to=String(body.to||'').trim(),person=requireString(body.person,100),occasion=requireString(body.occasion,250),point=requireString(body.point,300);
 const subject=`Following up — ${occasion}`;
 const text=`Dear ${person},\n\nI enjoyed ${occasion}. Your point about ${point} stayed with me.\n\nI'd value the chance to ask you one or two follow-up questions about your experience in the field. If you have 15 minutes in the coming weeks, I'd be grateful for a brief conversation.\n\nThank you for your time.\n\nBest regards,\n[Student name]`;
 return {to,subject,text,format:'Minto-inspired: purpose first, supporting detail, specific request',status:'DRAFT — not sent',requiresApproval:true};}
async function api(req,res,path){
 if(req.method==='GET'&&path==='/api/state')return json(res,stateView());
 if(req.method==='GET'&&path==='/api/health')return json(res,{ok:true,version:'0.6.0',model:modelStatus()});
 if(req.method==='GET'&&path==='/api/google/status')return json(res,googleStatus());
 if(req.method==='GET'&&path.startsWith('/api/documents/')){const id=decodeURIComponent(path.split('/').at(-1));const state=readState();ensureCapability(state,'documents.read');const doc=getDoc(id);if(!doc)throw new ApiError(404,'Document not found');return json(res,{...doc,body:doc.body.slice(0,40000)});}
 if(req.method!=='POST')throw new ApiError(404,'No such API route');
 const body=await readBody(req,path==='/api/record/import'?36*1024*1024:12*1024*1024);
 if(path==='/api/reset'){
  const reset=resetState(body.demo!==false);clearGoogleVault();
  return json(res,{...reset,...stateView()});
 }
 if(path==='/api/onboard')return json(res,mutate('onboard',{year:body.year,school:body.school},state=>{state.student={name:String(body.name||'').slice(0,100),year:String(body.year||'1L').slice(0,10),school:String(body.school||'').slice(0,150),city:String(body.city||'').slice(0,150),interest:String(body.interest||'').slice(0,100)};return state.student;}));
 if(path==='/api/competency/reasoning')return json(res,mutate('competency.reasoning',{id:body.id},state=>storeReasoning(state,body)));
 if(path==='/api/record/import'){
  ensureCapability(readState(),'documents.read');
  if(typeof body.base64!=='string'||body.base64.length>35*1024*1024)throw new ApiError(413,'Record PDF too large');
  if(body.confirm!=='IMPORT HISTORICAL RECORD')throw new ApiError(403,'Historical record import requires confirmation');
  const record=ocrRecord(Buffer.from(body.base64,'base64'));
  storePrimaryRecord(record);audit('record.ingest',{source:record.sourceId,sha256:record.sha256,pageCount:record.count,verified:false});
  return json(res,{result:{sha256:record.sha256,pageCount:record.count,verification:'User-provided PDF authenticity not independently confirmed; OCR text not human verified; unreviewed pages sealed until historical reveal'},...stateView()});
 }
 if(path==='/api/record/search'){
  const state=readState();ensureCapability(state,'documents.read');
  const query=requireString(body.query,300);const pages=searchableRecordPages(readPrimaryRecord(),state.sim.stage,query);
  return json(res,{pages,extracts:recordExtracts(state.sim.stage),warning:'OCR pages are unverified scans, not independent factual findings. Sealed pages never surface before reveal.'});
 }
 if(path==='/api/legal/verify'){
  const state=readState(),claim=requireString(body.claim,3000),citation=requireString(body.citation,180);
  const local=localVerify({claim,citation,quote:String(body.quote||''),stage:state.sim.stage,record:readPrimaryRecord()});
  let external={status:'not-requested'};
  if(body.external===true){ensureCapability(state,'legal.external');external=await courtListenerLookup(citation);}
  audit('legal.verify',{citation,conclusion:local.conclusion,externalStatus:external.status});
  return json(res,{result:local,external});
 }
 if(path==='/api/realism/rate')return json(res,mutate('realism.human-rating',{turnId:body.turnId},state=>recordHumanRating(state,body)));
 if(path==='/api/assess')return json(res,mutate('assessment',{id:body.id},state=>assess(state,body.id,body.answer)));
 if(path==='/api/sim/config')return json(res,mutate('simulation.config',{side:body.side,mode:body.mode,role:body.role},state=>{
  if(state.sim.stage!==0||state.sim.work.length)throw new ApiError(409,'Restart the case before changing its side or mode.');
  if(!['plaintiff','railroad'].includes(body.side)||!['historical','practice'].includes(body.mode))throw new ApiError(400,'Invalid setting');
  state.sim.side=body.side;state.sim.mode=body.mode;if(['client','railroad','counsel','judge'].includes(body.role))state.sim.role=body.role;return state.sim;}));
 if(path==='/api/sim/role')return json(res,mutate('simulation.role',{role:body.role},state=>{const allowed=state.sim.stage>=3?['judge','opposing']:['client','railroad','opposing'];if(!allowed.includes(body.role))throw new ApiError(400,'Role is not available at this stage');state.sim.role=body.role;return body.role;}));
 if(path==='/api/sim/work')return json(res,mutate('simulation.work',{stage:readState().sim.stage},state=>submitWork(state,body.text)));
 if(path==='/api/sim/review'){
  const state=readState();ensureCapability(state,'simulation.respond');
  if(modelStatus().enabled&&modelStatus().provider==='remote'&&state.permissions['model.remote']!=='allow')throw new ApiError(403,'Remote review requires model.remote permission.');
  const latest=[...state.sim.work].reverse().find(w=>w.stage===state.sim.stage);
  if(!latest)throw new ApiError(400,'Submit a work product at this stage before requesting feedback.');
  const existing=state.sim.reviews?.find(x=>x.workId===latest.id);
  if(existing)return json(res,{value:{...existing,repeat:true},...stateView()});
  const result=await reviewSimulationWork(state);
  return json(res,mutate('simulation.review',{stage:state.sim.stage,engine:result.kind},s=>{
   if(s.sim.stage!==state.sim.stage||!s.sim.work.some(w=>w.id===latest.id))throw new ApiError(409,'Case stage or work changed during review.');
   const item={...result,id:`review-${Date.now()}`,stage:s.sim.stage,workId:latest.id,at:new Date().toISOString(),side:s.sim.side};
   s.sim.reviews??=[];s.sim.reviews.push(item);
   s.practiceEvidence??=[];s.practiceEvidence.push({id:item.id,competency:'legal-analysis',context:'case-work',sourceId:latest.id,stage:item.stage,kind:item.kind,at:item.at,masteryImpact:'none — formative review only'});
   return item;
  }));
 }
 if(path==='/api/sim/advance')return json(res,mutate('simulation.advance',{},state=>advance(state)));
 if(path==='/api/sim/reverse')return json(res,mutate('simulation.reverse',{},state=>roleSwitch(state)));
 if(path==='/api/sim/talk'){
  ensureCapability(readState(),'simulation.respond');
  const text=requireString(body.text,3000);const state=readState();
  if(modelStatus().enabled&&modelStatus().provider==='remote'&&state.permissions['model.remote']!=='allow')throw new ApiError(403,'Remote AI requires permission. Open Data & controls and set model.remote to ALLOW, or use a local model.');
  if(state.sim.stage===5){const answer={text:'The historical reveal is open. Compare your argument with the actual reported opinions. For practice, use role reversal to defend the opposite position.',engine:'reveal'};return json(res,mutate('simulation.talk',{role:'reveal'},s=>{s.sim.transcript.push({role:'user',content:text,speakerRole:s.sim.role,stage:s.sim.stage},{id:`turn-${Date.now()}-${Math.random().toString(36).slice(2)}`,role:'assistant',content:answer.text,engine:answer.engine,speakerRole:s.sim.role,stage:s.sim.stage});return answer;}));}
  const response=await simulationResponse(state,text);
  return json(res,mutate('simulation.talk',{stage:state.sim.stage,engine:response.engine},s=>{if(s.sim.stage!==state.sim.stage||s.sim.role!==state.sim.role)throw new ApiError(409,'Simulation stage or interlocutor changed');s.sim.transcript.push({role:'user',content:text,speakerRole:s.sim.role,stage:s.sim.stage},{id:`turn-${Date.now()}-${Math.random().toString(36).slice(2)}`,role:'assistant',content:response.text,engine:response.engine,speakerRole:s.sim.role,stage:s.sim.stage});s.sim.transcript=s.sim.transcript.slice(-90);return response;}));
 }
 if(path==='/api/research/search'){const state=readState();ensureCapability(state,'documents.read');const query=requireString(body.query,500);const hits=searchDocuments(query,8,{historicalVeil:state.sim.stage<5});audit('research.search',{termCount:query.trim().split(/\s+/).length,hits:hits.length});return json(res,{query,scope:'local-imported-documents',hits,historicalVeil:state.sim.stage<5,verification:'passage-locators-only; Palsgraf-related uploads quarantined while outcome is sealed; legal propositions NOT independently verified'});}
 if(path==='/api/tutor/talk'){
  const text=requireString(body.text,3000);const state=readState();
  if(modelStatus().enabled&&modelStatus().provider==='remote'&&state.permissions['model.remote']!=='allow')throw new ApiError(403,'Remote AI requires permission. Open Data & controls and set model.remote to ALLOW, or use a local model.');
  const hits=state.permissions['documents.read']==='allow'?searchDocuments(text,5,{historicalVeil:state.sim.stage<5}):[];
  const allowed=['explain','teach','socratic','cold-call','hint','exam','model-answer'];const mode=allowed.includes(body.mode)?body.mode:'socratic';
  const result=await tutoringResponse(state,text,mode,hits);audit('tutor.turn',{mode,engine:result.engine,citations:hits.map(h=>h.id)});return json(res,{result,citations:hits,verification:'retrieved excerpts; no legal claim-level verification'});
 }
 if(path==='/api/documents'){ensureCapability(readState(),'documents.read');return json(res,await ingest(body));}
 if(path==='/api/drafts')return json(res,mutate('draft.create',{person:body.person},state=>{ensureCapability(state,'draft.create');const draft=createMintoDraft(body);state.drafts.unshift(draft);return draft;}));
 // Career actions: all local state mutations are audited; bookings are NEVER assumed.
 if(path==='/api/events/import'){
  const name=requireString(body.name,150);if(typeof body.base64!=='string'||body.base64.length>2700000)throw new ApiError(413,'Event feed file too large');
  const input=Buffer.from(body.base64,'base64').toString('utf8');const events=parseICalendar(input,{source:name});
  return json(res,mutate('events.import',{name,count:events.length},s=>{s.events??=[];const ids=new Set(s.events.map(e=>e.id));let count=0;for(const e of events){if(!ids.has(e.id)){s.events.push(e);ids.add(e.id);count++;}}return {imported:count,parsed:events.length,source:name};}));
 }
 if(path==='/api/events/sync'){
  const state=readState();ensureCapability(state,'events.read');const target=body.feedId?PUBLIC_FEEDS.find(x=>x.id===body.feedId)?.url:body.url;
  if(!target)throw new ApiError(400,'Choose a live feed');const live=await fetchPublicFeed(target);
  return json(res,mutate('events.sync',{source:live.source,count:live.events.length},s=>{s.events??=[];const prior=new Map(s.events.map(e=>[e.id,e]));for(const e of live.events){prior.set(e.id,{...e,saved:prior.get(e.id)?.saved||false});}s.events=[...prior.values()].slice(-500);return {fetched:live.events.length,source:live.source,fetchedAt:live.fetchedAt};}));
 }
 if(path==='/api/events/save')return json(res,mutate('events.save',{id:body.id},s=>{const event=s.events.find(e=>e.id===body.id);if(!event)throw new ApiError(404,'Event not found');event.saved=!!body.saved;return {id:event.id,saved:event.saved};}));
 if(path==='/api/events/remove')return json(res,mutate('events.remove',{id:body.id},s=>{const before=s.events.length;s.events=s.events.filter(e=>e.id!==body.id);if(s.events.length===before)throw new ApiError(404,'Event not found');return {removed:body.id};}));
 if(path==='/api/events/ics'){
  const event=readState().events.find(e=>e.id===body.id);if(!event)throw new ApiError(404,'Event not found');return json(res,{filename:'amicus-event.ics',content:eventToICS(event),note:'Calendar export does not register for an event'});
 }
 if(path==='/api/contacts')return json(res,mutate('contacts.save',{id:body.id||null},s=>{s.contacts??=[];const idx=s.contacts.findIndex(c=>c.id===body.id);const contact=createContact(body,idx>=0?s.contacts[idx]:null);if(idx>=0)s.contacts[idx]=contact;else s.contacts.unshift(contact);return contact;}));
 if(path==='/api/contacts/delete')return json(res,mutate('contacts.delete',{id:body.id},s=>{const before=s.contacts.length;s.contacts=s.contacts.filter(c=>c.id!==body.id);if(s.contacts.length===before)throw new ApiError(404,'Contact not found');return {removed:body.id};}));
 if(path==='/api/contacts/interaction')return json(res,mutate('contacts.interaction',{id:body.id,kind:body.kind},s=>{const c=s.contacts.find(x=>x.id===body.id);if(!c)throw new ApiError(404,'Contact not found');return addInteraction(c,body);}));
 if(path==='/api/tasks')return json(res,mutate('tasks.create',{title:body.title},s=>{s.tasks??=[];const t=createTask(body);s.tasks.unshift(t);return t;}));
 if(path==='/api/tasks/delete')return json(res,mutate('tasks.delete',{id:body.id},s=>{const before=s.tasks.length;s.tasks=s.tasks.filter(t=>t.id!==body.id);if(s.tasks.length===before)throw new ApiError(404,'Task not found');return {removed:body.id};}));
 if(path==='/api/tasks/complete')return json(res,mutate('tasks.complete',{id:body.id},s=>{const t=s.tasks.find(x=>x.id===body.id);if(!t)throw new ApiError(404,'Task not found');t.done=!!body.done;return t;}));
 if(path==='/api/speakers/research'){
  ensureCapability(readState(),'people.research');const result=await searchSpeaker(requireString(body.name,120));audit('speakers.search',{termLength:body.name.length,results:result.candidates.length});return json(res,result);
 }
 if(path==='/api/google/disconnect'){
  if(!['gmail','calendar'].includes(body.service))throw new ApiError(400,'Invalid Google service');
  const result=disconnectGoogle(body.service);audit('google.disconnect',{service:body.service});return json(res,result);
 }
 if(path==='/api/google/calendar/list'){
  ensureCapability(readState(),'calendar.read');const events=await listCalendar();audit('calendar.read',{count:events.length});return json(res,{events,status:'Live connected Google Calendar; no changes made'});
 }
 if(path==='/api/google/calendar/create'){
  const state=readState();ensureCapability(state,'calendar.write');
  if(body.confirm!=='CREATE CALENDAR EVENT')throw new ApiError(403,'Explicit calendar approval required');
  const event=state.events.find(x=>x.id===body.id);if(!event)throw new ApiError(404,'Event not found');
  if(event.googleCalendarId)throw new ApiError(409,'Calendar entry already created for this event');
  if(outboundInFlight.has('calendar:'+event.id))throw new ApiError(409,'Calendar entry creation already in progress');
  outboundInFlight.add('calendar:'+event.id);
  try{
   const created=await createCalendarEvent(event);
   return json(res,mutate('calendar.created',{eventId:event.id,calendarEventId:created.id},s=>{const e=s.events.find(x=>x.id===event.id);e.googleCalendarId=created.id;return {id:created.id,url:created.htmlLink||null,status:'Calendar event created. This is NOT event registration.'};}));
  }finally{outboundInFlight.delete('calendar:'+event.id);}
 }
 if(path==='/api/google/gmail/draft'){
  const state=readState();ensureCapability(state,'gmail.draft');if(body.confirm!=='CREATE GMAIL DRAFT')throw new ApiError(403,'Explicit Gmail draft approval required');
  const draft=state.drafts.find(x=>x.id===body.id);if(!draft)throw new ApiError(404,'Draft not found');
  if(draft.gmailDraftId)throw new ApiError(409,'Already created in Gmail; open Gmail to edit or send');
  if(outboundInFlight.has('draft:'+draft.id))throw new ApiError(409,'Draft creation already in progress');
  outboundInFlight.add('draft:'+draft.id);
  try{
   const created=await createGmailDraft(draft);
   return json(res,mutate('gmail.draft.created',{draftId:draft.id},s=>{const d=s.drafts.find(x=>x.id===draft.id);d.gmailDraftId=created.id;d.status='GMAIL DRAFT — not sent';return {id:d.id,gmailDraftId:created.id,status:d.status};}));
  }finally{outboundInFlight.delete('draft:'+draft.id);}
 }
 if(path==='/api/google/gmail/send'){
  const state=readState();ensureCapability(state,'email.send');if(body.confirm!=='SEND EMAIL')throw new ApiError(403,'Explicit send approval required');
  const draft=state.drafts.find(x=>x.id===body.id);if(!draft?.gmailDraftId)throw new ApiError(400,'Create a Gmail draft before sending');
  if(draft.status==='SENT')throw new ApiError(409,'Already sent');
  if(outboundInFlight.has('send:'+draft.id))throw new ApiError(409,'Email send already in progress');
  outboundInFlight.add('send:'+draft.id);
  try{
   const sent=await sendGmailDraft(draft.gmailDraftId);
   return json(res,mutate('gmail.sent',{draftId:draft.id,gmailId:sent.id},s=>{const d=s.drafts.find(x=>x.id===draft.id);d.status='SENT';d.sentAt=new Date().toISOString();d.gmailMessageId=sent.id;return {id:d.id,status:d.status,gmailMessageId:sent.id};}));
  }finally{outboundInFlight.delete('send:'+draft.id);}
 }
 if(path==='/api/permissions')return json(res,mutate('permission.change',{capability:body.capability,value:body.value},state=>{if(!(body.capability in state.permissions)||!['allow','ask','deny'].includes(body.value))throw new ApiError(400,'Invalid permission');state.permissions[body.capability]=body.value;return state.permissions;}));
 if(path==='/api/export')return json(res,{state:readState(),documents:listDocs().map(d=>getDoc(d.id)),primaryRecord:readPrimaryRecord(),audit:allAudit(),exportedAt:new Date().toISOString()});
 throw new ApiError(404,'No such API route');
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);
  if(path==='/api/google/connect'&&req.method==='GET'){
   const service=url.searchParams.get('service');const location=beginGoogle(service);res.writeHead(302,{Location:location,'Cache-Control':'no-store'});return res.end();
  }
  if(path==='/api/google/callback'&&req.method==='GET'){
   const service=await completeGoogle({state:url.searchParams.get('state'),code:url.searchParams.get('code')});audit('google.connected',{service});res.writeHead(302,{Location:'/?connected='+encodeURIComponent(service),'Cache-Control':'no-store'});return res.end();
  }
  if(path.startsWith('/api/')){
   if(req.method==='POST'){
    const origin=req.headers.origin;
    if(origin && ![ `http://127.0.0.1:${port}`, `http://localhost:${port}` ].includes(origin))throw new ApiError(403,'Cross-origin write blocked');
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new ApiError(415,'JSON content type required');
   }
   return await api(req,res,path);
  }
  if(req.method!=='GET')throw new ApiError(405,'Method not allowed');
  const target=path==='/'?'/index.html':path;
  if(!['/index.html','/app.js','/styles.css'].includes(target))throw new ApiError(404,'Not found');
  const body=await readFile(join(root,target.slice(1)));res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(body);
 }catch(e){json(res,{error:e.message||'Unexpected error'},e.status||(/^(Submit|Work product|Unknown assessment|Invalid answer|Role reversal|Already at historical reveal)/.test(e.message||'')?400:500));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Amicus running at http://127.0.0.1:${port} · ${modelStatus().enabled?'Live model configured':'Guided offline demo (no LLM)'}`));
