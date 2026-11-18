import caseData from '../data/palsgraf.json' with { type: 'json' };

export const CASE = caseData;
export const STAGE_COUNT = CASE.history.length;
export const ASSESSMENTS = [
  {id:'transfer-1', topic:'proximate-cause', name:'Unmarked hazard', prompt:'A grocery worker carelessly leaves a small obstruction in an aisle. A shopper trips; the fall causes an unforeseeable chain of events injuring someone in a distant room. Which question most directly tests the scope of negligence liability?', choices:['Whether any harm occurred anywhere','Whether this type of victim and harm fell within the risks that made the conduct negligent','Whether the worker intended a distant injury','Whether the shop was profitable'], correct:1, explanation:'Negligence liability turns on legally relevant risks, not merely an unbroken causal chain. Analyze both duty/scope of duty and proximate cause under the applicable law.'},
  {id:'transfer-2', topic:'duty', name:'Whose right?', prompt:'A defendant acts carelessly toward Person A. Person B suffers unexpected harm far away. What must counsel address before asserting negligence liability to B?', choices:['Only whether A could sue','Whether a duty of care was owed to B and whether the risk is within the duty','Whether the defendant personally knew B','Only whether B felt upset'], correct:1, explanation:'A negligence claim requires a duty owed to the plaintiff. Defining duty and foreseeability requires jurisdiction-specific analysis.'},
  {id:'transfer-3', topic:'advocacy', name:'The hard question', prompt:'A judge asks why your theory would not make every negligent act liable for every remote consequence. Which answer is strongest?', choices:['All consequences always create liability','I have not considered limits','My limiting principle is the reasonably foreseeable class of plaintiffs and risks, applied to the evidence','The jury will figure it out'], correct:2, explanation:'An advocate should articulate a limiting principle and apply it to the factual record rather than relying on bare conclusions.'}
];

export function initialState(demo=true){
 return {
  mode:demo?'demo':'fresh', student:{name:demo?'Demo student':'', year:demo?'1L':'',school:'', city:'',interest:'Litigation'},
  mastery:{duty:{correct:3,total:5,confidence:'low',history:[]},'proximate-cause':{correct:2,total:5,confidence:'low',history:[]},advocacy:{correct:1,total:3,confidence:'low',history:[]}},
  assessments:[], courses: demo?[{id:'torts',name:'Torts',description:'Negligence · Duty · Scope of liability',status:'demo seed'}]:[],
  sim:{stage:0, side:'plaintiff',mode:'historical',role:'client',transcript:[],work:[],notes:'',reversed:false},
  permissions:{'email.send':'ask','calendar.write':'ask','events.book':'ask','draft.create':'allow','documents.read':'allow','simulation.respond':'allow','model.remote':'ask'},
  contacts:[], drafts:[], events:[], activity:[], createdAt:new Date().toISOString()
 };
}
export function scoreFor(v){ return v&&v.total?Math.round(100*v.correct/v.total):null; }
export function assess(state, id, answer) {
 const item=ASSESSMENTS.find(x=>x.id===id);
 if(!item) throw new Error('Unknown assessment');
 if(!Number.isInteger(answer)||answer<0||answer>=item.choices.length) throw new Error('Invalid answer');
 const prior=state.assessments.find(x=>x.id===id);
 if(prior) return {correct:prior.correct,repeat:true,explanation:item.explanation,score:scoreFor(state.mastery[item.topic])};
 const correct=answer===item.correct;
 state.assessments.push({id,topic:item.topic,answer,correct,at:new Date().toISOString(),method:'deterministic-choice-key'});
 const m=state.mastery[item.topic]??(state.mastery[item.topic]={correct:0,total:0,history:[]});
 m.total+=1;if(correct)m.correct+=1;
 m.history.push({assessmentId:id,correct,at:new Date().toISOString()});
 m.confidence=m.history.length>=3?'moderate':'low';
 return {correct, repeat:false,explanation:item.explanation, score:scoreFor(m),method:'deterministic-choice-key'};
}
export function visibleFacts(sim,role='counsel'){
 return CASE.facts.filter(x=>x.unlocksAt<=sim.stage && (['counsel','opposing'].includes(role)||x.knownBy.includes(role)));
}
export function visibleSources(sim){return CASE.sources.filter(s=>s.unlock<=sim.stage);}
export function isOutcomeQuestion(text){
 const s=String(text);
 return /(?:cardozo|andrews|final (?:holding|judgment|outcome|decision)|who won|how did (?:it|the case) end|248\s*N\.?Y\.?\s*339|may 29,? 1928)/i.test(s)
  || /(?:1928|court of appeals|appellate court).{0,85}(?:reversed|affirmed|held|majority|dissent|judgment|decided|ultimately)/i.test(s)
  || /(?:railroad|railway|plaintiff|palsgraf).{0,65}(?:ultimately (?:won|lost|prevailed)|was (?:reversed|affirmed))/i.test(s);
}
export function canAdvance(sim){return sim.work.some(w=>w.stage===sim.stage && w.text.trim().length>=40);}
export function advance(state){
 if(state.sim.stage>=STAGE_COUNT-1) throw new Error('Already at historical reveal');
 if(!canAdvance(state.sim)) throw new Error('Submit a substantive work product (at least 40 characters) for this stage before advancing.');
 state.sim.stage+=1;
 state.sim.role=state.sim.stage===3?'judge':state.sim.stage===4?'judge':'client';
 return CASE.history[state.sim.stage];
}
export function submitWork(state,text){
 const value=String(text||'').trim();
 if(value.length<40||value.length>8000) throw new Error('Work product must be 40–8,000 characters');
 const item={id:`work-${Date.now()}-${state.sim.work.length}`,stage:state.sim.stage,text:value,at:new Date().toISOString(),side:state.sim.side};
 state.sim.work.push(item);
 return item;
}
export function roleSwitch(state){
 if(state.sim.stage!==STAGE_COUNT-1)throw new Error('Role reversal unlocks after the historical reveal.');
 const previous=state.sim.work.map(x=>x.text).join('\n').slice(-3000);
 state.sim.side=state.sim.side==='plaintiff'?'railroad':'plaintiff';
 state.sim.stage=0;state.sim.reversed=true;state.sim.work=[];state.sim.transcript=[];state.sim.role='client';
 return {previousArguments:previous,side:state.sim.side};
}
export function evidenceAudit(state){return {
  outcomeSealed:state.sim.stage<STAGE_COUNT-1,
  visibleFacts:visibleFacts(state.sim).length,
  totalHistoricalFacts:CASE.facts.length,
  sourceLinks:visibleSources(state.sim).length,
  sourcedFacts:CASE.facts.every(f=>CASE.sources.some(s=>s.id===f.source)),
  skillEstimates:Object.fromEntries(Object.entries(state.mastery).map(([k,v])=>[k,{score:scoreFor(v),confidence:v.confidence,evidence:v.history.length}]))
};}
export function appendActivity(state,kind,detail){state.activity.unshift({id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind,detail,at:new Date().toISOString()});state.activity=state.activity.slice(0,200);}
