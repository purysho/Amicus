import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialState} from '../server/engine.mjs';
import {simulationResponse,modelStatus} from '../server/ai.mjs';
import {evaluateTurn,RUBRIC} from '../server/realism.mjs';
if(process.env.AMICUS_MODEL_BASE_URL&&process.env.AMICUS_MODEL&&!process.argv.includes('--allow-model')){
 console.error('Model configured: pass --allow-model to allow calls during evaluation. Otherwise unset the model variables for guided baseline.');
 process.exitCode=2;
}else{
 const fixtures=JSON.parse(readFileSync(resolve('evals/realism-fixtures.json')));
 const results=[];
 for(const fixture of fixtures){
  const state=initialState();state.sim.stage=fixture.stage;state.sim.role=fixture.role;
  const answer=await simulationResponse(state,fixture.question);
  const observed=evaluateTurn({response:answer.text,role:fixture.role,stage:fixture.stage,allowedFacts:[]});
  results.push({id:fixture.id,role:fixture.role,stage:fixture.stage,engine:answer.engine,guardrailPass:observed.guardrailPass,findings:observed.findings,criteria:fixture.criteria,replyLength:observed.wordCount});
 }
 const report={version:'surface-guardrails-v1',evaluatedAt:new Date().toISOString(),model:modelStatus(),cases:fixtures.length,guardrailPassed:results.filter(x=>x.guardrailPass).length,guardrailFailed:results.filter(x=>!x.guardrailPass).length,actualHumanNaturalness:null,independentlyVerifiedLegalAccuracy:null,trainingOnTranscripts:false,limitations:['Guided offline baseline is NOT a generative or human-like model benchmark','Surface lexical checks cannot prove factual grounding or legal competence','Human courtroom realism requires blinded evaluation against published transcripts and independent annotators'],humanRubric:RUBRIC,results};
 console.log(JSON.stringify(report,null,2));
 if(report.guardrailFailed)process.exitCode=1;
}
