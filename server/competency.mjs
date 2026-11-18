// Evidence ledger for measured performance. Demo priors and ungraded model feedback
// are never silently counted as independent proof of competence.
export const TRANSFER_EXERCISES=[
 {id:'novel-shop-negligence',skill:'proximate-cause',context:'retail',title:'An unexpected secondary injury',prompt:'A store manager leaves a cart in the aisle. A customer strikes it and drops a phone, prompting a bystander to chase a thief and stumble into another shopper. Write a negligence analysis of the injured shopper’s claim, including the strongest limit on the theory.',rubric:['Identify the alleged negligent conduct','Distinguish cause in fact and scope of liability','Address foreseeable victims and risks','Address a plausible counterargument']},
 {id:'novel-medical-referral',skill:'duty',context:'medical',title:'A referral with missing information',prompt:'A medical office sends an incorrect specialist address to a patient. An unrelated pedestrian becomes injured during the patient’s hurried trip. Explain how you would analyze whether a duty was owed to the pedestrian without assuming the ultimate outcome.',rubric:['Identify the potential plaintiff','Separate breach from existence and scope of duty','Articulate a limiting principle','Identify facts needed before reaching a conclusion']},
 {id:'novel-construction-hearing',skill:'advocacy',context:'construction',title:'The skeptical judge',prompt:'A construction company negligently leaves a board near a walkway. A third party later moves the board, and a distant visitor is injured. State your position, a limiting rule, and your best answer to a judge asking why the injury is not too remote.',rubric:['State a precise theory','Cite facts rather than assumptions','Provide a meaningful limiting principle','Confront intervening cause and opposing theory']}
];
export function storeReasoning(state,{id,text,selfConfidence}){
 const task=TRANSFER_EXERCISES.find(t=>t.id===id);
 if(!task)throw new Error('Unknown transfer exercise');
 if(typeof text!=='string'||text.trim().length<90||text.length>8000)throw new Error('Answer must be 90–8000 characters');
 if(!Number.isInteger(selfConfidence)||selfConfidence<1||selfConfidence>5)throw new Error('Confidence must be an integer from 1 to 5');
 state.reasoningEvidence??=[];
 const previous=state.reasoningEvidence.find(r=>r.id===id);
 if(previous)return {...previous,repeat:true};
 const result={id,skill:task.skill,context:task.context,text:text.trim(),selfConfidence,at:new Date().toISOString(),grading:'ungraded — independent feedback required',rubric:task.rubric,masteryImpact:'none until independently and reproducibly graded'};
 state.reasoningEvidence.push(result);
 return result;
}
export function competencyReport(state){
 return [...new Set(['duty','proximate-cause','advocacy',...Object.keys(state.mastery||{})])].map(skill=>{
  const objective=(state.assessments||[]).filter(a=>a.topic===skill);
  const written=(state.reasoningEvidence||[]).filter(a=>a.skill===skill);
  const other=(state.practiceEvidence||[]).filter(a=>a.competency===skill);
  const correct=objective.filter(a=>a.correct).length;
  const contexts=new Set([...objective.map(x=>x.context||x.id),...written.map(x=>x.context)]);
  const independent=objective.length;
  const readiness=independent>=4&&contexts.size>=3?'provisional estimate':'insufficient independent evidence';
  const measured=readiness==='provisional estimate'?Math.round(100*correct/independent):null;
  const challenge=written.length?'Review an independently scored written transfer exercise':'Complete a novel open-response transfer exercise';
  return {skill,correct,objectiveCount:independent,uniqueContexts:contexts.size,writtenCount:written.length,formativeCount:other.length,measuredPercent:measured,readiness,challenge,seededPrior:state.mode==='demo'?'synthetic; excluded':'none',uncertainty:'Scores are uncalibrated and are not grade predictions.'};
 });
}
