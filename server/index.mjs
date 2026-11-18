import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {CASE, ASSESSMENTS,initialState,assess,visibleFacts,visibleSources,advance,submitWork,roleSwitch,evidenceAudit,appendActivity} from './engine.mjs';
import {readState,saveState,resetState,listDocs,getDoc,addDoc,searchDocuments,audit,latestAudit} from './db.mjs';
import {simulationResponse,tutoringResponse,modelStatus} from './ai.mjs';
if(existsSync('.env')){try{process.loadEnvFile('.env');}catch(e){console.warn('Could not read .env:',e.message);}}
const port=Number(process.env.PORT||4173);const root=resolve('public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function json(res,value,status=200){const data=JSON.stringify(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
async function readBody(req,limit=12*1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new ApiError(413,'Request too large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new ApiError(400,'Invalid JSON');}}
function stateView(){const state=readState();return {state,caseInfo:{title:CASE.title,citation:CASE.citation,stages:CASE.history,stage:CASE.history[state.sim.stage],facts:visibleFacts(state.sim),sources:visibleSources(state.sim),reveal:state.sim.stage===5?CASE.reveal:null},assessments:ASSESSMENTS,documents:listDocs(),model:modelStatus(),evidence:evidenceAudit(state),audit:latestAudit()};}
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
 if(req.method==='GET'&&path==='/api/health')return json(res,{ok:true,version:'0.3.0',model:modelStatus()});
 if(req.method==='GET'&&path.startsWith('/api/documents/')){const id=decodeURIComponent(path.split('/').at(-1));const state=readState();ensureCapability(state,'documents.read');const doc=getDoc(id);if(!doc)throw new ApiError(404,'Document not found');return json(res,{...doc,body:doc.body.slice(0,40000)});}
 if(req.method!=='POST')throw new ApiError(404,'No such API route');
 const body=await readBody(req);
 if(path==='/api/reset')return json(res,{...resetState(body.demo!==false),...stateView()});
 if(path==='/api/onboard')return json(res,mutate('onboard',{year:body.year,school:body.school},state=>{state.student={name:String(body.name||'').slice(0,100),year:String(body.year||'1L').slice(0,10),school:String(body.school||'').slice(0,150),city:String(body.city||'').slice(0,150),interest:String(body.interest||'').slice(0,100)};return state.student;}));
 if(path==='/api/assess')return json(res,mutate('assessment',{id:body.id},state=>assess(state,body.id,body.answer)));
 if(path==='/api/sim/config')return json(res,mutate('simulation.config',{side:body.side,mode:body.mode,role:body.role},state=>{
  if(state.sim.stage!==0||state.sim.work.length)throw new ApiError(409,'Restart the case before changing its side or mode.');
  if(!['plaintiff','railroad'].includes(body.side)||!['historical','practice'].includes(body.mode))throw new ApiError(400,'Invalid setting');
  state.sim.side=body.side;state.sim.mode=body.mode;if(['client','railroad','counsel','judge'].includes(body.role))state.sim.role=body.role;return state.sim;}));
 if(path==='/api/sim/role')return json(res,mutate('simulation.role',{role:body.role},state=>{const allowed=state.sim.stage>=3?['judge','opposing']:['client','railroad','opposing'];if(!allowed.includes(body.role))throw new ApiError(400,'Role is not available at this stage');state.sim.role=body.role;return body.role;}));
 if(path==='/api/sim/work')return json(res,mutate('simulation.work',{stage:readState().sim.stage},state=>submitWork(state,body.text)));
 if(path==='/api/sim/advance')return json(res,mutate('simulation.advance',{},state=>advance(state)));
 if(path==='/api/sim/reverse')return json(res,mutate('simulation.reverse',{},state=>roleSwitch(state)));
 if(path==='/api/sim/talk'){
  ensureCapability(readState(),'simulation.respond');
  const text=requireString(body.text,3000);const state=readState();
  if(modelStatus().enabled&&modelStatus().provider==='remote'&&state.permissions['model.remote']!=='allow')throw new ApiError(403,'Remote AI requires permission. Open Data & controls and set model.remote to ALLOW, or use a local model.');
  if(state.sim.stage===5){const answer={text:'The historical reveal is open. Compare your argument with the actual reported opinions. For practice, use role reversal to defend the opposite position.',engine:'reveal'};return json(res,mutate('simulation.talk',{role:'reveal'},s=>{s.sim.transcript.push({role:'user',content:text},{role:'assistant',content:answer.text,engine:answer.engine});return answer;}));}
  const response=await simulationResponse(state,text);
  return json(res,mutate('simulation.talk',{stage:state.sim.stage,engine:response.engine},s=>{if(s.sim.stage!==state.sim.stage)throw new ApiError(409,'Simulation stage changed');s.sim.transcript.push({role:'user',content:text},{role:'assistant',content:response.text,engine:response.engine});s.sim.transcript=s.sim.transcript.slice(-90);return response;}));
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
 if(path==='/api/drafts')return json(res,mutate('draft.create',{person:body.person},state=>{ensureCapability(state,'draft.create');const draft={...draftEmail(body),id:`draft-${Date.now()}`,createdAt:new Date().toISOString()};state.drafts.unshift(draft);return draft;}));
 if(path==='/api/permissions')return json(res,mutate('permission.change',{capability:body.capability,value:body.value},state=>{if(!(body.capability in state.permissions)||!['allow','ask','deny'].includes(body.value))throw new ApiError(400,'Invalid permission');state.permissions[body.capability]=body.value;return state.permissions;}));
 if(path==='/api/export')return json(res,{state:readState(),documents:listDocs().map(d=>getDoc(d.id)),audit:latestAudit(),exportedAt:new Date().toISOString()});
 throw new ApiError(404,'No such API route');
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);
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
