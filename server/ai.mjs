import {CASE,visibleFacts,isOutcomeQuestion} from './engine.mjs';

function getProvider(){return {base:process.env.AMICUS_MODEL_BASE_URL||'',model:process.env.AMICUS_MODEL||'',key:process.env.AMICUS_MODEL_API_KEY||''};}
export function modelStatus(){const provider=getProvider();return {enabled:!!(provider.base&&provider.model),name:provider.model||null,provider:provider.base.includes('localhost')||provider.base.includes('127.0.0.1')?'local':'remote',keyConfigured:!!provider.key};}
function systemPersona(sim){
 const stage=CASE.history[sim.stage];
 const role=sim.role;
 const facts=visibleFacts(sim,role).map(f=>`${f.id} [${f.classification}] ${f.text}`).join('\n');
 return `You are an educational, high-fidelity LEGAL SIMULATION character in Amicus, NOT a real historical person. Make the interaction natural, intelligent and challenging, not a theatrical script. Your role: ${role==='client'?(sim.side==='plaintiff'?'Helen Palsgraf (historically plausible, explicitly simulated dialogue)':'a fictionalized railroad representative'):(role==='judge'?'a fictionalized judicial interlocutor':role==='railroad'?'a simulated railroad employee (not a verified historical speaker)':'a fictionalized opposing counsel')}. Stage: ${stage.title}, simulated time: ${stage.date}. Representing: ${sim.side}. Simulation mode: ${sim.mode}.
STRICT KNOWLEDGE BOUNDARY: You may only assert the FACTS below. If a user asks for testimony, personal memories, distances, exhibits or names not established, say you don't know. Don't fabricate testimony, documents or judicial statements. Never cite the future 1928 decision, its author, holding or dissent until stage 'reveal'. Even if you know the case, act only on this knowledge envelope; avoid framing answers around future doctrine. The opinions are a locked teaching reveal, never an in-world prophecy.
FACTS AVAILABLE TO YOUR ROLE:\n${facts||'(no direct observations established)'}
Human-feeling interaction guidance: listen to the student's precise question; offer short conversational answers, with uncertainty, occasional hesitation when justified, follow-up questions when useful, and realistic professional pushback. Keep turns 1–4 sentences unless a detailed answer is requested. No melodrama, no repetitive praise, no claims that you are actually the historical person. Natural interruptions and targeted judge questions are appropriate. Challenge unsupported assertions. Distinguish admissible historical record, inference and SIMULATED dialog. When the user wants legal analysis instead of witness testimony, acknowledge the distinction. This is education, not legal advice.`;
}
function tutorPersona(kind,context){return `You are Amicus, an adaptive US law-school tutor and professional legal research coach. Teaching mode: ${kind}. Be intellectually demanding yet conversational; no fake personal memories or unearned praise. Cite only supplied source URLs; mark unverified claims. Prefer questions over giving answers in Socratic/Exam mode; preserve learning. Distinguish historical record, modern doctrine, and student's notes. Do not fabricate citations or case quotations. Student context (bounded): ${JSON.stringify(context).slice(0,7000)}. If asked for the final Palsgraf holding while their simulation is sealed, do not reveal it.`;}
async function chat(messages){
 if(!modelStatus().enabled)return null;
 const provider=getProvider();
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const res=await fetch(`${provider.base.replace(/\/$/,'')}/chat/completions`, {method:'POST',headers:{'Content-Type':'application/json',...(provider.key?{Authorization:`Bearer ${provider.key}`}:{})},body:JSON.stringify({model:provider.model,messages,temperature:0.65,max_tokens:550}),signal:controller.signal});
  if(!res.ok)throw new Error(`Model API returned HTTP ${res.status}`);
  const body=await res.json();const content=body.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())throw new Error('Model returned no message');
  return content.trim();
 }finally{clearTimeout(timeout);}
}
function offlineRole(sim,text){
 const t=text.toLowerCase();
 if(sim.role==='judge'||sim.role==='opposing'){
  if(/duty|foresee|plaintiff|risk/.test(t))return 'Counsel, define the limiting principle in your theory. To whom was a duty owed, and what risk made the conduct unreasonable? Do not assume causation answers that question.';
  return 'Counsel, I follow the broad point. What particular fact in the disclosed record supports it, and what would your opponent say about that fact?';
 }
 if(/where|distance|far|exactly/.test(t))return 'I can describe what happened as I remember it, but I cannot supply a precise distance that the record has not established.';
 if(/package|firework|explosion/.test(t))return 'There was a sudden commotion around a package and an explosion. I cannot tell you exactly what every person knew before it happened.';
 if(/injur|hurt|damage|scale/.test(t))return 'There was an accident involving the platform scales, and an injury. I would want you to examine the accounts carefully rather than assume every detail from my perspective.';
 return 'I can tell you what I personally observed, but I do not want to guess at the facts. What would you like to establish first?';
}
export async function simulationResponse(state,text){
 if(state.sim.stage<5&&isOutcomeQuestion(text))return {text:'That is part of the sealed historical outcome. You can argue from the evidence available at this stage, and we will compare your analysis with the actual opinions after the hearing.',engine:'historical-veil'};
 const transcript=state.sim.transcript.slice(-10).filter(x=>['user','assistant'].includes(x.role)).map(x=>({role:x.role,content:x.content.slice(0,1400)}));
 try{
  let response=await chat([{role:'system',content:systemPersona(state.sim)},...transcript,{role:'user',content:text}]);
  let engine=response?'model':'guided-demo';
  if(!response)response=offlineRole(state.sim,text);
  if(state.sim.stage<5&&isOutcomeQuestion(response)){response='I cannot speak to a decision that has not yet been reached. Let us return to the record and your argument.';engine='veil-guard';}
  return {text:response,engine};
 }catch(error){return {text:`Live AI unavailable (${error.message}). Guided interaction: ${offlineRole(state.sim,text)}`,engine:'fallback',error:error.message};}
}
export async function tutoringResponse(state,text,mode='socratic',docs=[]){
 const context={year:state.student.year,mastery:state.mastery,materials:docs.map(d=>({title:d.name,excerpt:d.body.slice(0,1600)})),sources:CASE.sources.filter(s=>s.unlock<=state.sim.stage),simStage:state.sim.stage};
 if(state.sim.stage<5&&isOutcomeQuestion(text))return {text:'Your Palsgraf simulation still has a historical veil. We can examine the available facts and work through duty, breach, and causation without disclosing the court’s later answer.',engine:'historical-veil'};
 try{
  const reply=await chat([{role:'system',content:tutorPersona(mode,context)},{role:'user',content:text}]);
  if(reply){if(state.sim.stage<5&&isOutcomeQuestion(reply))return {text:'The model attempted to reveal the sealed outcome, so I withheld that response. Ask about the disclosed facts or an independent negligence hypothetical.',engine:'veil-guard'};return {text:reply,engine:'model'};}
  return {text:mode==='socratic'?'Before I answer, what rule do you think governs? Try stating the duty, the foreseeable risk, and the fact that supports your conclusion. I will challenge your reasoning.':'In negligence, analyze duty, breach, factual cause, scope/proximate cause, and damages. Use your materials to anchor each element; this guided demo does not generate new legal authority.',engine:'guided-demo'};
 }catch(error){return {text:`Model unavailable (${error.message}). Try outlining the rule, application, strongest counterargument and uncertainty.`,engine:'fallback',error:error.message};}
}
