import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {CASE, ASSESSMENTS,initialState,visibleFacts,visibleSources} from '../server/engine.mjs';
test('career navigation renders live feed, contacts, tasks, speaker lookup and consent-based integrations',async()=>{
 const code=readFileSync(resolve(import.meta.dirname,'../public/app.js'),'utf8');const nodes=new Map(),handlers=new Map();
 function get(key){if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return nodes.get(key);}
 const state=initialState(true);state.contacts.push({id:'person-1',name:'Attorney <Example>',organization:'Court',role:'Speaker',relationship:'introduced',interactions:[]});state.tasks.push({id:'task-1',title:'Submit application',kind:'career',done:false,due:'2027-01-01T10:00:00Z'});state.events.push({id:'evt-1',title:'Legal Careers Panel',start:'2027-01-02T10:00:00Z',source:'Test school feed',url:'https://example.edu/event',status:'discovered',saved:false});
 const data={state,model:{enabled:false,provider:'offline'},assessments:ASSESSMENTS,caseInfo:{stages:CASE.history,stage:CASE.history[0],facts:visibleFacts(state.sim),sources:visibleSources(state.sim),reveal:null},evidence:{visibleFacts:visibleFacts(state.sim).length,outcomeSealed:true},documents:[],audit:[],career:{sources:[],ranked:[{id:'evt-1',score:3,rationale:'Matches your interests'}],plan:{gaps:[],goals:[]},google:{configured:false,gmail:false,calendar:false}}};
 const context=vm.createContext({document:{querySelector:get,querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers.set(name,fn)},console,clearTimeout,setTimeout,fetch:async()=>({ok:true,json:async()=>data})});vm.runInContext(code,context,{filename:'public/app.js'});await new Promise(r=>setImmediate(r));
 await handlers.get('click')({target:{closest:s=>s==='[data-tab]'?{dataset:{tab:'career'}}:null}});
 const out=get('#view').innerHTML;
 for(const phrase of ['Public event discovery','Approved HTTPS','Legal Careers Panel','Speaker research','Minto-style','Google integrations','Interaction journal','Upcoming commitments'])assert.ok(out.includes(phrase),`Missing ${phrase}`);
 assert.ok(out.includes('Attorney &lt;Example&gt;'),'contact names must be HTML escaped');assert.ok(!out.includes('Attorney <Example>'));
 assert.equal(get('#crumb-title').textContent,'Career strategy');
});
