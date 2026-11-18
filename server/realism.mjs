import {isOutcomeQuestion} from './engine.mjs';
export const RUBRIC={
 sourceFidelity:'Does the character distinguish observed, reported and unknown facts?',
 roleFidelity:'Does the character stay within the professional role and knowledge boundary?',
 responsiveness:'Does the reply answer the specific question instead of repeating stock text?',
 conversationalNaturalness:'Does the pacing, turn-taking, follow-up and tone feel human without theatrical filler?',
 proceduralFidelity:'Does courtroom language and questioning fit the stage and role?'
};
const STOCK=[/great (question|point)/i,/as an ai language model/i,/i am here to help/i,/it is important to note/i,/let me explain in detail/i];
export function evaluateTurn({response,role='judge',stage=0,allowedFacts=[]}){
 const text=String(response||'');
 const words=text.match(/\S+/g)||[];
 const findings=[];
 if(stage<5&&isOutcomeQuestion(text))findings.push({id:'historical-leak',severity:'block'});
 for(const regex of STOCK)if(regex.test(text))findings.push({id:'generic-or-meta-dialogue',severity:'review'});
 if(words.length>150)findings.push({id:'overlong-response',severity:'review'});
 if(role==='judge'&&/^i (personally )?(saw|heard|remember)\b/i.test(text))findings.push({id:'role-confusion',severity:'review'});
 const refs=[...text.matchAll(/\[(?:fact\s*)?(f\d+)\]/ig)].map(m=>m[1].toLowerCase());
 if(refs.some(id=>!allowedFacts.includes(id)))findings.push({id:'unknown-fact-id',severity:'block'});
 return {role,stage,wordCount:words.length,findings,guardrailPass:!findings.some(f=>f.severity==='block'),naturalnessScore:null,legalAccuracyScore:null,note:'Surface-level rule checks only. Human naturalness and legal correctness require blinded annotation.'};
}
export function evaluateTranscript(transcript, visibleFactIds=[]){
 const assistants=transcript.filter(t=>t.role==='assistant');
 const checks=assistants.map(t=>evaluateTurn({response:t.content,role:t.speakerRole,stage:t.stage,allowedFacts:visibleFactIds}));
 return {turns:assistants.length,passed:checks.filter(c=>c.guardrailPass).length,failed:checks.filter(c=>!c.guardrailPass).length,checks,benchmark:'surface-guardrails-v1',humanNaturalness:null,actualTranscriptTraining:false};
}
export function recordHumanRating(state,{turnId,ratings,reviewerNote=''}){
 const matching=state.sim.transcript.find(t=>t.id===turnId&&t.role==='assistant');if(!matching)throw new Error('No assistant turn with that ID');
 if(typeof ratings!=='object'||ratings===null)throw new Error('Ratings required');
 const safe={};for(const field of Object.keys(RUBRIC)){
  if(!Number.isInteger(ratings[field])||ratings[field]<1||ratings[field]>5)throw new Error('All five rubric scores must be 1–5');
  safe[field]=ratings[field];
 }
 if(typeof reviewerNote!=='string'||reviewerNote.length>1000)throw new Error('Review note must be under 1000 characters');
 state.sim.realismRatings??=[];
 const item={turnId,ratings:safe,reviewerNote,at:new Date().toISOString(),method:'human self-rating (not independent or blinded)'};
 const old=state.sim.realismRatings.findIndex(r=>r.turnId===turnId);
 if(old>=0)state.sim.realismRatings[old]=item;else state.sim.realismRatings.push(item);
 return item;
}
