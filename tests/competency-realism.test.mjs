import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,assess,publicAssessments} from '../server/engine.mjs';
import {storeReasoning,competencyReport,TRANSFER_EXERCISES} from '../server/competency.mjs';
import {evaluateTurn,evaluateTranscript,recordHumanRating,RUBRIC} from '../server/realism.mjs';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
test('quiz answer keys are not sent to student before assessment',()=>{
 const state=initialState();const first=publicAssessments(state).find(q=>q.id==='transfer-1');assert.equal('correct' in first,false);
 assess(state,'transfer-1',1);assert.equal(publicAssessments(state).find(q=>q.id==='transfer-1').correct,1);
});
test('synthetic demo priors never masquerade as measured independent competency',()=>{
 const state=initialState();const first=competencyReport(state).find(x=>x.skill==='duty');
 assert.equal(first.objectiveCount,0);assert.equal(first.measuredPercent,null);assert.equal(first.seededPrior,'synthetic; excluded');
 assess(state,'transfer-2',1);const second=competencyReport(state).find(x=>x.skill==='duty');
 assert.equal(second.objectiveCount,1);assert.equal(second.measuredPercent,null);
});
test('open-response work is stored once with no unauthorized numeric grade update',()=>{
 const state=initialState();const before=structuredClone(state.mastery);
 const id=TRANSFER_EXERCISES[0].id;
 const entry=storeReasoning(state,{id,text:'I would first identify the risk making the obstruction negligent. The bystander argument is difficult because a voluntary intervening chase creates questions about causal scope and foreseeability.',selfConfidence:4});
 assert.equal(entry.grading.startsWith('ungraded'),true);
 assert.deepEqual(state.mastery,before);
 assert.equal(storeReasoning(state,{id,text:entry.text,selfConfidence:4}).repeat,true);
 assert.equal(state.reasoningEvidence.length,1);
});
test('invalid or empty reasoning is rejected rather than scored',()=>{
 const state=initialState();assert.throws(()=>storeReasoning(state,{id:'novel-shop-negligence',text:'Easy answer',selfConfidence:5}),/90/);
 assert.throws(()=>storeReasoning(state,{id:'novel-shop-negligence',text:'A'.repeat(100),selfConfidence:6}),/Confidence/);
});
test('surface diagnostics flag historical leaks and made-up IDs, not naturalness scores',()=>{
 const r=evaluateTurn({response:'Chief Judge Cardozo decided this later [f99].',stage:1,allowedFacts:['f1'],role:'client'});
 assert.equal(r.guardrailPass,false);assert.equal(r.naturalnessScore,null);
 assert.ok(r.findings.some(x=>x.id==='historical-leak'));
 assert.ok(r.findings.some(x=>x.id==='unknown-fact-id'));
});
test('measured guardrails are distinguished from human realism',()=>{
 const report=evaluateTranscript([{role:'assistant',content:'Counsel, what evidence supports your theory?',stage:4,speakerRole:'judge'}],[]);
 assert.equal(report.passed,1);assert.equal(report.humanNaturalness,null);assert.equal(report.actualTranscriptTraining,false);
});
test('human ratings must be attributable and explicitly marked non-blinded',()=>{
 const s=initialState();s.sim.transcript.push({id:'turn-test',role:'assistant',content:'What is your limiting principle?',speakerRole:'judge',stage:4});
 const ratings=Object.fromEntries(Object.keys(RUBRIC).map(k=>[k,3]));
 const saved=recordHumanRating(s,{turnId:'turn-test',ratings,reviewerNote:'Requires better pacing'});
 assert.match(saved.method,/not independent or blinded/);
 assert.throws(()=>recordHumanRating(s,{turnId:'missing',ratings}),/No assistant turn/);
});
test('realism fixture pack covers adversarial knowledge and realistic discourse',()=>{
 const cases=JSON.parse(readFileSync(resolve(import.meta.dirname,'../evals/realism-fixtures.json')));
 assert.ok(cases.length>=10);
 assert.ok(cases.some(c=>/future disposition|future/i.test(c.criteria)));
 assert.ok(cases.some(c=>/unknown|unsupported/i.test(c.criteria)));
});
