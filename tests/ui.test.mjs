import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {CASE, ASSESSMENTS, initialState, visibleFacts, visibleSources} from '../server/engine.mjs';

// No browser dependency: exercise the shipped renderer against a DOM-shaped test harness.
test('clicking Case simulation renders the historical matter instead of a blank view', async () => {
  const script = readFileSync(resolve(import.meta.dirname, '../public/app.js'), 'utf8');
  const nodes = new Map();
  const handlers = new Map();
  const getNode = (key) => {
    if (!nodes.has(key)) nodes.set(key, {innerHTML:'', textContent:'', classList:{add(){},remove(){},toggle(){}},addEventListener(){}});
    return nodes.get(key);
  };
  const student = initialState(true);
  const data = {
    state:student,
    model:{enabled:false,provider:'offline'},
    assessments:ASSESSMENTS,
    caseInfo:{stages:CASE.history,stage:CASE.history[0],facts:visibleFacts(student.sim),sources:visibleSources(student.sim),reveal:null},
    evidence:{visibleFacts:visibleFacts(student.sim).length,outcomeSealed:true},
    documents:[],audit:[]
  };
  const document = {
    querySelector:getNode,
    querySelectorAll:() => [],
    addEventListener:(name,cb) => handlers.set(name,cb),
  };
  const context = vm.createContext({
    document, console, clearTimeout, setTimeout,
    fetch:async()=>({ok:true,json:async()=>data}),
  });
  vm.runInContext(script,context,{filename:'public/app.js'});
  await new Promise(resolve => setImmediate(resolve));
  assert.match(getNode('#view').innerHTML,/Your path/);
  await handlers.get('click')({target:{closest:(selector)=>selector==='[data-tab]'?{dataset:{tab:'case'}}:null}});
  assert.match(getNode('#view').innerHTML,/Palsgraf: a case in motion/);
  assert.match(getNode('#view').innerHTML,/Conversation chamber/);
  assert.match(getNode('#view').innerHTML,/Evidence ledger/);
  assert.equal(getNode('#crumb-title').textContent,'Case simulation');
});
