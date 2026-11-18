import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const root=resolve(import.meta.dirname,'..');
function freePort(){return new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
test('v0.2 SQLite documents migrate to searchable passages without erasing student files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'amicus-migrate-'));const dbPath=join(dir,'amicus.db');
 const old=new DatabaseSync(dbPath);
 old.exec('CREATE TABLE documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL)');
 old.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('old-one','existing-notes.txt','text','A personal jurisdiction analysis begins with contacts and notice.','2026-01-01');
 old.close();
 const port=await freePort();const proc=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,PORT:String(port),AMICUS_DB:dbPath,AMICUS_MODEL:'',AMICUS_MODEL_BASE_URL:''},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 try{
  let started=false;for(let attempt=0;attempt<70;attempt++){try{const r=await fetch(base+'/api/health');if(r.ok){started=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.equal(started,true);
  const result=await fetch(base+'/api/research/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'personal jurisdiction contacts'})});
  assert.equal(result.status,200);
  const search=await result.json();assert.equal(search.hits.length,1);assert.equal(search.hits[0].name,'existing-notes.txt');
  const doc=await (await fetch(base+'/api/documents/old-one')).json();
  assert.match(doc.body,/personal jurisdiction/);
 }finally{
  proc.kill();await new Promise(resolve=>proc.once('exit',resolve));await rm(dir,{recursive:true,force:true});
 }
});
